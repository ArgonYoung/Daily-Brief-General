#!/usr/bin/env python3
"""
Daily Brief → Feishu Document
=============================
Calls the DailyBrief render API, parses the returned Markdown into
Feishu document blocks (with image preprocessing), creates a Feishu
document, and returns the doc URL + content summary for notification.

Block types supported (Feishu docx API):
  2  = Text (paragraph)
  3  = Heading1
  4  = Heading2
  5  = Heading3
  12 = Bullet list
  13 = Ordered list
  15 = Quote
  22 = Divider
  27 = Image

Usage:
  python3 daily_brief.py --schedule-id <uuid> [options]

Options:
  --api-url       DailyBrief base URL (default: http://localhost:3000)
  --api-key       RENDER_API_KEY for auth
  --skip-closing  Tell the API to skip closing generation
  --dry-run       Parse and print blocks without creating a doc
"""

import argparse
import io
import json
import os
import re
import sys
import tempfile
import urllib.request
import urllib.error

from PIL import Image

# ── Feishu config (reuse from feishu_api.py) ──────────────────────────

HOME = os.path.expanduser("~/.hermes")
TOKEN_FILE = os.path.join(HOME, "feishu_tokens.json")
APP_ID = "cli_aab0a675f7f8dbdf"
APP_SECRET = ""  # Loaded from feishu_api.py at runtime
BASE = "https://open.feishu.cn/open-apis"

# Try to read APP_SECRET from the existing feishu_api.py
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "feishu_api",
        os.path.join(HOME, "skills/productivity/feishu/scripts/feishu_api.py"),
    )
    if spec:
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        APP_SECRET = mod.APP_SECRET
except Exception:
    pass


# ── Feishu token helpers ──────────────────────────────────────────────

def _load_tokens():
    try:
        with open(TOKEN_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def _save_tokens(data):
    with open(TOKEN_FILE, "w") as f:
        json.dump(data, f)


def _get_user_token():
    tokens = _load_tokens()
    if tokens.get("access_token"):
        return tokens["access_token"]
    rt = tokens.get("refresh_token")
    if not rt:
        raise RuntimeError("No user token. Run OAuth setup first.")
    body = json.dumps({
        "app_id": APP_ID, "app_secret": APP_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": rt,
    }).encode()
    r = urllib.request.Request(
        f"{BASE}/authen/v1/refresh_access_token",
        data=body, method="POST",
    )
    r.add_header("Content-Type", "application/json")
    d = json.loads(urllib.request.urlopen(r).read())
    if d["code"] != 0:
        raise RuntimeError(f"Token refresh failed: {d.get('msg', '')}")
    tokens["access_token"] = d["data"]["access_token"]
    tokens["refresh_token"] = d["data"]["refresh_token"]
    _save_tokens(tokens)
    return tokens["access_token"]


def _feishu_api(method, path, body=None, use_user=True, content_type="application/json"):
    """Call Feishu API with user token (or tenant token)."""
    token = _get_user_token() if use_user else _get_tenant_token()
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if body is not None:
        req.add_header("Content-Type", content_type)
        if content_type == "application/json":
            req.data = json.dumps(body).encode()
        else:
            req.data = body
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()[:500]
        return {"code": e.code, "msg": err_body}


def _get_tenant_token():
    body = json.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode()
    r = urllib.request.Request(
        f"{BASE}/auth/v3/tenant_access_token/internal",
        data=body, method="POST",
    )
    r.add_header("Content-Type", "application/json")
    d = json.loads(urllib.request.urlopen(r).read())
    return d["tenant_access_token"]


# ── Image processing ──────────────────────────────────────────────────

# Target width for images in the document (phone-friendly)
IMAGE_TARGET_WIDTH = 320
IMAGE_TARGET_HEIGHT = 180
IMAGE_QUALITY = 85


def download_image(url):
    """Download an image from URL, return raw bytes."""
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "DailyBrief/1.0")
    resp = urllib.request.urlopen(req, timeout=15)
    return resp.read()


def compress_image(raw_bytes):
    """Download, resize, and compress an image to uniform size.
    Returns JPEG bytes.
    """
    img = Image.open(io.BytesIO(raw_bytes))

    # Convert to RGB if necessary (handles RGBA/P modes)
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")

    # Resize to fit within target dimensions, maintaining aspect ratio
    img.thumbnail((IMAGE_TARGET_WIDTH, IMAGE_TARGET_HEIGHT), Image.LANCZOS)

    # Create a blank canvas of exact target size, paste image centered
    canvas = Image.new("RGB", (IMAGE_TARGET_WIDTH, IMAGE_TARGET_HEIGHT), (255, 255, 255))
    offset = (
        (IMAGE_TARGET_WIDTH - img.width) // 2,
        (IMAGE_TARGET_HEIGHT - img.height) // 2,
    )
    canvas.paste(img, offset)

    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=IMAGE_QUALITY)
    return buf.getvalue()


def upload_image_to_feishu(image_bytes, doc_id, filename="brief_image.jpg"):
    """Upload image to Feishu and return file_token."""
    token = _get_user_token()

    # Build multipart/form-data manually
    boundary = "----DailyBriefBoundary7MA4YWxkTrZu0gW"
    parts = []

    # file_name
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(b'Content-Disposition: form-data; name="file_name"\r\n\r\n')
    parts.append(filename.encode() + b"\r\n")

    # parent_type
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(b'Content-Disposition: form-data; name="parent_type"\r\n\r\n')
    parts.append(b"ccm_docx_image\r\n")

    # parent_node
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(b'Content-Disposition: form-data; name="parent_node"\r\n\r\n')
    parts.append(doc_id.encode() + b"\r\n")

    # size
    size_str = str(len(image_bytes))
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(b'Content-Disposition: form-data; name="size"\r\n\r\n')
    parts.append(size_str.encode() + b"\r\n")

    # file
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    )
    parts.append(b"Content-Type: image/jpeg\r\n\r\n")
    parts.append(image_bytes)
    parts.append(b"\r\n")

    # End boundary
    parts.append(f"--{boundary}--\r\n".encode())

    body = b"".join(parts)

    req = urllib.request.Request(
        f"{BASE}/drive/v1/medias/upload_all",
        data=body,
        method="POST",
    )
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    resp = urllib.request.urlopen(req, timeout=30)
    d = json.loads(resp.read())
    if d.get("code") != 0:
        raise RuntimeError(f"Image upload failed: {d}")
    return d["data"]["file_token"]


# ── Markdown → Feishu blocks ──────────────────────────────────────────

def parse_rich_text(text):
    """Parse a string for **bold** markers and return a list of text_run elements.

    This is the ONLY place where inline formatting is parsed.
    All block builders use this function for consistency.
    """
    elements = []
    # Split on **bold** markers, keeping the delimiters
    parts = re.split(r"(\*\*[^*]+\*\*)", text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            inner = part[2:-2]
            if inner:
                elements.append({
                    "text_run": {
                        "content": inner,
                        "text_element_style": {"bold": True},
                    }
                })
        else:
            elements.append({
                "text_run": {
                    "content": part,
                    "text_element_style": {},
                }
            })
    # Ensure at least one element (Feishu requires non-empty elements)
    if not elements:
        elements.append({"text_run": {"content": " ", "text_element_style": {}}})
    return elements


def make_text_block(text, bold=False):
    """Paragraph block (block_type 2)."""
    if bold:
        # Wrap entire text in bold
        elements = [{
            "text_run": {
                "content": text,
                "text_element_style": {"bold": True},
            }
        }]
    else:
        elements = parse_rich_text(text)
    return {
        "block_type": 2,
        "text": {"elements": elements, "style": {}},
    }


def make_heading_block(text, level=3):
    """Heading block. level: 1-9 → block_type 3-11."""
    block_type = 2 + level  # 3=H1, 4=H2, 5=H3, ...
    elements = parse_rich_text(text)
    return {
        "block_type": block_type,
        f"heading{level}": {"elements": elements, "style": {}},
    }


def make_bullet_block(text):
    """Bulleted list item (block_type 12)."""
    elements = parse_rich_text(text)
    return {
        "block_type": 12,
        "bullet": {"elements": elements, "style": {}},
    }


def make_ordered_block(text):
    """Ordered list item (block_type 13)."""
    elements = parse_rich_text(text)
    return {
        "block_type": 13,
        "ordered": {"elements": elements, "style": {}},
    }


def make_quote_block(text):
    """Quote block (block_type 15)."""
    elements = parse_rich_text(text)
    return {
        "block_type": 15,
        "quote": {"elements": elements, "style": {}},
    }


def make_divider_block():
    """Divider block (block_type 22)."""
    return {"block_type": 22, "divider": {}}


def make_image_block(file_token):
    """Image block (block_type 27)."""
    return {
        "block_type": 27,
        "image": {"token": file_token, "width": IMAGE_TARGET_WIDTH, "height": IMAGE_TARGET_HEIGHT},
    }


# Regex patterns for line classification
RE_HEADING = re.compile(r"^(#{1,6})\s+(.+)$")
RE_BULLET = re.compile(r"^[-*]\s+(.+)$")
RE_ORDERED = re.compile(r"^\d+\.\s+(.+)$")
RE_QUOTE = re.compile(r"^>\s*(.*)$")
RE_DIVIDER = re.compile(r"^---+$")
RE_IMAGE = re.compile(r"^!\[([^\]]*)\]\((https?://[^)]+)\)\s*$")


def markdown_to_feishu_blocks(markdown, doc_id=None, fetch_images=True):
    """Convert Markdown text to a list of Feishu document blocks.

    This is a deterministic, line-by-line parser. Each line is classified
    exactly once by the regex patterns above, ensuring consistent mapping.

    Args:
        markdown: The Markdown string to parse.
        doc_id: Feishu document ID (required if fetch_images=True for image upload).
        fetch_images: If True, download/compress/upload images. If False, skip image blocks.

    Returns:
        List of Feishu block dicts.
    """
    blocks = []
    lines = markdown.split("\n")

    for line in lines:
        line = line.rstrip()  # Preserve leading whitespace for now, strip trailing

        # Skip empty lines
        if not line.strip():
            continue

        # 1. Image: ![alt](url)
        m = RE_IMAGE.match(line.strip())
        if m:
            if fetch_images and doc_id:
                url = m.group(2)
                try:
                    raw = download_image(url)
                    compressed = compress_image(raw)
                    file_token = upload_image_to_feishu(compressed, doc_id)
                    blocks.append(make_image_block(file_token))
                except Exception as e:
                    # If image fails, insert a text placeholder
                    blocks.append(make_text_block(f"[图片加载失败: {e}]"))
            else:
                # Skip image in dry-run mode
                blocks.append(make_text_block(f"[图片: {m.group(2)}]"))
            continue

        # 2. Divider: ---
        if RE_DIVIDER.match(line.strip()):
            blocks.append(make_divider_block())
            continue

        # 3. Heading: # text, ## text, ### text
        m = RE_HEADING.match(line.strip())
        if m:
            level = len(m.group(1))
            text = m.group(2)
            blocks.append(make_heading_block(text, level=level))
            continue

        # 4. Quote: > text
        m = RE_QUOTE.match(line.strip())
        if m:
            text = m.group(1) or " "
            blocks.append(make_quote_block(text))
            continue

        # 5. Bullet list: - text or * text
        m = RE_BULLET.match(line.strip())
        if m:
            blocks.append(make_bullet_block(m.group(1)))
            continue

        # 6. Ordered list: 1. text
        m = RE_ORDERED.match(line.strip())
        if m:
            blocks.append(make_ordered_block(m.group(1)))
            continue

        # 7. Plain text paragraph
        blocks.append(make_text_block(line.strip()))

    return blocks


# ── Feishu document creation ──────────────────────────────────────────

FEISHU_MAX_BLOCKS_PER_REQUEST = 50  # API limit


def create_feishu_doc(title, folder_token=None):
    """Create a new Feishu document, return (doc_id, url)."""
    body = {"title": title}
    if folder_token:
        body["folder_token"] = folder_token
    d = _feishu_api("POST", "/docx/v1/documents", body)
    if d.get("code") != 0:
        raise RuntimeError(f"Failed to create doc: {d}")
    doc = d["data"]["document"]
    return doc["document_id"], doc.get("url", "")


def append_blocks_to_doc(doc_id, blocks):
    """Append blocks to a Feishu document, batching if necessary.

    The Feishu API allows max 50 children per request.
    """
    total = len(blocks)
    idx = 0
    while idx < total:
        batch = blocks[idx:idx + FEISHU_MAX_BLOCKS_PER_REQUEST]
        body = {"children": batch, "index": -1}
        d = _feishu_api(
            "POST",
            f"/docx/v1/documents/{doc_id}/blocks/{doc_id}/children",
            body,
        )
        if d.get("code") != 0:
            raise RuntimeError(
                f"Failed to append blocks (batch {idx//FEISHU_MAX_BLOCKS_PER_REQUEST + 1}): {d}"
            )
        idx += FEISHU_MAX_BLOCKS_PER_REQUEST


# ── Render API client ─────────────────────────────────────────────────

def call_render_api(api_url, api_key, schedule_id, skip_closing=False):
    """Call DailyBrief render API, return BriefPayload JSON."""
    url = f"{api_url}/api/briefs/render"
    body = json.dumps({
        "briefScheduleId": schedule_id,
        "skipClosing": skip_closing,
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if api_key:
        req.add_header("Authorization", f"Bearer {api_key}")

    resp = urllib.request.urlopen(req, timeout=120)
    return json.loads(resp.read())


# ── Main pipeline ─────────────────────────────────────────────────────

def generate_brief_doc(payload, folder_token=None, dry_run=False):
    """Take a BriefPayload, create a Feishu document, return (doc_id, url, plain_text_summary).

    The document structure is:
      [Greeting paragraph]
      [Divider]
      For each section:
        [Bold paragraph: section title]
        [Parsed Markdown blocks]
        [Divider]
      [Closing paragraph] (if closing exists)
    """
    # 1. Build all blocks (except images, which need doc_id first)
    # We do a two-pass approach:
    #   Pass 1: Build blocks without images (images need doc_id for upload)
    #   Pass 2: After doc creation, process images

    # Actually, we need doc_id before we can upload images.
    # So: create doc first, then build blocks with image upload.

    if dry_run:
        # In dry-run mode, don't create a real doc
        blocks = []
        blocks.append(make_text_block(payload["greeting"]))
        blocks.append(make_divider_block())
        for section in payload["sections"]:
            blocks.append(make_text_block(section["title"], bold=True))
            section_blocks = markdown_to_feishu_blocks(
                section["markdown"], doc_id=None, fetch_images=False
            )
            blocks.extend(section_blocks)
            blocks.append(make_divider_block())
        if payload.get("closing"):
            blocks.append(make_text_block(payload["closing"]))

        print(json.dumps({"blocks": blocks, "block_count": len(blocks)},
                         ensure_ascii=False, indent=2))
        return None, None, payload["greeting"]

    # 2. Create the Feishu document
    doc_id, doc_url = create_feishu_doc(payload["title"], folder_token)

    # 3. Build blocks (now we have doc_id for image uploads)
    all_blocks = []

    # Greeting
    all_blocks.append(make_text_block(payload["greeting"]))
    all_blocks.append(make_divider_block())

    # Sections
    plain_text_parts = [payload["greeting"]]
    for section in payload["sections"]:
        # Section title as bold paragraph
        all_blocks.append(make_text_block(section["title"], bold=True))
        plain_text_parts.append(f"{section['title']}: {section['markdown']}")

        # Parse section Markdown into blocks (with image processing)
        section_blocks = markdown_to_feishu_blocks(
            section["markdown"], doc_id=doc_id, fetch_images=True
        )
        all_blocks.extend(section_blocks)
        all_blocks.append(make_divider_block())

    # Closing
    if payload.get("closing"):
        all_blocks.append(make_text_block(payload["closing"]))
        plain_text_parts.append(payload["closing"])

    # 4. Append all blocks to the document
    append_blocks_to_doc(doc_id, all_blocks)

    # 5. Build plain text summary for LLM consumption
    plain_text = "\n".join(plain_text_parts)

    return doc_id, doc_url, plain_text


# ── CLI ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Daily Brief → Feishu Document")
    parser.add_argument("--schedule-id", required=True, help="BriefSchedule UUID")
    parser.add_argument("--api-url", default="http://localhost:3000",
                        help="DailyBrief base URL")
    parser.add_argument("--api-key", default=os.environ.get("RENDER_API_KEY", ""),
                        help="RENDER_API_KEY for auth")
    parser.add_argument("--skip-closing", action="store_true",
                        help="Skip closing generation in the API")
    parser.add_argument("--folder-token", default=os.environ.get("FEISHU_FOLDER_TOKEN", ""),
                        help="Feishu folder token for doc placement")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and print blocks without creating a doc")
    args = parser.parse_args()

    # 1. Call render API
    print(f"[Daily Brief] Calling render API for schedule {args.schedule_id}...")
    try:
        payload = call_render_api(
            args.api_url, args.api_key, args.schedule_id, args.skip_closing
        )
    except Exception as e:
        print(json.dumps({"error": f"Render API call failed: {e}"}, ensure_ascii=False))
        sys.exit(1)

    print(f"[Daily Brief] Got payload: title={payload.get('title')}, "
          f"sections={len(payload.get('sections', []))}, "
          f"closing={'yes' if payload.get('closing') else 'no'}")

    # 2. Create Feishu document
    print("[Daily Brief] Creating Feishu document...")
    doc_id, doc_url, plain_text = generate_brief_doc(
        payload,
        folder_token=args.folder_token or None,
        dry_run=args.dry_run,
    )

    if args.dry_run:
        return

    # 3. Output result for the skill to consume
    result = {
        "status": "success",
        "doc_id": doc_id,
        "doc_url": doc_url,
        "title": payload["title"],
        "plain_text": plain_text,
        "section_count": len(payload.get("sections", [])),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
