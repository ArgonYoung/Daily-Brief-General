import { runSandbox } from "./runner";

describe("QuickJS Sandbox Runner", () => {
  it("executes basic arithmetic returning result", async () => {
    const code = `
      export default {
        async run({ inputs }) {
          return "Output is: " + (inputs.a + inputs.b);
        }
      }
    `;
    const result = await runSandbox(code, { a: 10, b: 20 }, {
      fetch: async () => new Response(""),
      llmComplete: async () => "",
    });
    expect(result).toBe("Output is: 30");
  });

  it("prevents execution from accessing global node variables", async () => {
    const code = `
      export default {
        async run() {
          return typeof process !== 'undefined' ? "unsafe" : "safe";
        }
      }
    `;
    const result = await runSandbox(code, {}, {
      fetch: async () => new Response(""),
      llmComplete: async () => "",
    });
    expect(result).toBe("safe");
  });
});
