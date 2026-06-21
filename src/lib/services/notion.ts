import { Client } from "@notionhq/client";

function parseRichText(text: string): any[] {
  // Regex to split on bold text markers **...**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return {
          type: "text",
          text: {
            content: part.slice(2, -2),
          },
          annotations: {
            bold: true,
          },
        };
      }
      return {
        type: "text",
        text: {
          content: part,
        },
      };
    })
    .filter((p) => p.text.content !== "");
}

function markdownToNotionBlocks(markdown: string): any[] {
  const lines = markdown.split("\n");
  const blocks: any[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) {
      continue; // Skip empty lines to keep it compact
    }

    if (line.startsWith("###")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: parseRichText(line.replace(/^###\s*/, "")),
        },
      });
    } else if (line.startsWith("##")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: parseRichText(line.replace(/^##\s*/, "")),
        },
      });
    } else if (line.startsWith("#")) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: parseRichText(line.replace(/^#\s*/, "")),
        },
      });
    } else if (line.startsWith(">")) {
      const quoteText = line.replace(/^>\s*/, "");
      blocks.push({
        object: "block",
        type: "quote",
        quote: {
          rich_text: parseRichText(quoteText || " "),
        },
      });
    } else if (line === "---" || line === "---") {
      blocks.push({
        object: "block",
        type: "divider",
        divider: {},
      });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const listText = line.replace(/^[-*]\s*/, "");
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: parseRichText(listText),
        },
      });
    } else if (/^\d+\.\s+/.test(line)) {
      const listText = line.replace(/^\d+\.\s+/, "");
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: parseRichText(listText),
        },
      });
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: parseRichText(line),
        },
      });
    }
  }

  // Fallback if no blocks were parsed
  if (blocks.length === 0) {
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: markdown },
          },
        ],
      },
    });
  }

  // Notion API limit: max 100 children in create page
  return blocks.slice(0, 100);
}

export async function pushBriefToNotion(
  notionToken: string,
  parentPageId: string,
  briefTitle: string,
  briefContentMarkdown: string
): Promise<string> {
  const notion = new Client({ auth: notionToken });

  // Create a subpage under the parentPageId
  const response = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [
          {
            text: {
              content: briefTitle,
            },
          },
        ],
      },
    },
    children: markdownToNotionBlocks(briefContentMarkdown),
  });

  return (response as any).url || `https://notion.so/${response.id.replace(/-/g, "")}`;
}
