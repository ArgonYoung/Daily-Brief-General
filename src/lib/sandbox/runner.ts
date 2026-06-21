import { getQuickJS, QuickJSContext, QuickJSHandle } from "quickjs-emscripten";

export interface SandboxSDK {
  fetch: (url: string, init?: any) => Promise<any>;
  llmComplete: (prompt: string) => Promise<string>;
}

export async function runSandbox(
  moduleCode: string,
  inputs: Record<string, any>,
  sdk: SandboxSDK
): Promise<string> {
  const quickJS = await getQuickJS();
  const vm = quickJS.newContext();

  try {
    // 1. Inject inputs
    const inputsHandle = vm.newObject();
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === "string") {
        const valHandle = vm.newString(value);
        vm.setProp(inputsHandle, key, valHandle);
        valHandle.dispose();
      } else if (typeof value === "number") {
        const valHandle = vm.newNumber(value);
        vm.setProp(inputsHandle, key, valHandle);
        valHandle.dispose();
      } else if (typeof value === "boolean") {
        const valHandle = value ? vm.true : vm.false;
        vm.setProp(inputsHandle, key, valHandle);
      }
    }
    vm.setProp(vm.global, "inputs", inputsHandle);
    inputsHandle.dispose();

    // 2. Inject sdk object with async helpers
    const sdkHandle = vm.newObject();

    // Helper to wrap host-side async function into a guest promise
    const createAsyncFunction = (
      name: string,
      hostFn: (...args: string[]) => Promise<any>,
      serializer: (ctx: QuickJSContext, result: any) => QuickJSHandle
    ) => {
      return vm.newFunction(name, (...argsHandles) => {
        const args = argsHandles.map(h => vm.dump(h));
        const promise = vm.newPromise();

        hostFn(...args)
          .then((res) => {
            const resHandle = serializer(vm, res);
            promise.resolve(resHandle);
            resHandle.dispose();
            vm.runtime.executePendingJobs();
          })
          .catch((err) => {
            const errHandle = vm.newError(err.message || String(err));
            promise.reject(errHandle);
            errHandle.dispose();
            vm.runtime.executePendingJobs();
          });

        return promise.handle;
      });
    };

    // sdk.fetch(url)
    const sdkFetch = createAsyncFunction(
      "fetch",
      async (url, optionsJson) => {
        const options = optionsJson ? JSON.parse(optionsJson) : undefined;
        const response = await sdk.fetch(url, options);
        const text = await response.text();
        const status = response.status;
        const statusText = response.statusText;
        const headers = Array.from(response.headers.entries());
        return { text, status, statusText, headers };
      },
      (ctx, res) => {
        const obj = ctx.newObject();
        
        const textVal = ctx.newString(res.text);
        ctx.setProp(obj, "text_content", textVal);
        textVal.dispose();

        const textFn = ctx.newFunction("text", () => {
          return ctx.newString(res.text);
        });
        ctx.setProp(obj, "text", textFn);
        textFn.dispose();

        const jsonFn = ctx.newFunction("json", () => {
          try {
            const parsedVal = ctx.evalCode(`JSON.parse(${JSON.stringify(res.text)})`);
            if (parsedVal.error) {
              const err = parsedVal.error;
              parsedVal.error.dispose();
              return err;
            }
            const r = parsedVal.value;
            return r;
          } catch (e: any) {
            return ctx.newError(e.message || String(e));
          }
        });
        ctx.setProp(obj, "json", jsonFn);
        jsonFn.dispose();

        const statusVal = ctx.newNumber(res.status);
        ctx.setProp(obj, "status", statusVal);
        statusVal.dispose();

        const statusTextVal = ctx.newString(res.statusText);
        ctx.setProp(obj, "statusText", statusTextVal);
        statusTextVal.dispose();

        const okVal = res.status >= 200 && res.status < 300 ? ctx.true : ctx.false;
        ctx.setProp(obj, "ok", okVal);

        return obj;
      }
    );
    vm.setProp(sdkHandle, "fetch", sdkFetch);
    sdkFetch.dispose();

    // sdk.llm.complete(prompt)
    const sdkLlm = vm.newObject();
    const sdkLlmComplete = createAsyncFunction(
      "complete",
      async (prompt) => {
        return await sdk.llmComplete(prompt);
      },
      (ctx, res) => ctx.newString(res)
    );
    vm.setProp(sdkLlm, "complete", sdkLlmComplete);
    sdkLlmComplete.dispose();

    vm.setProp(sdkHandle, "llm", sdkLlm);
    sdkLlm.dispose();

    vm.setProp(vm.global, "sdk", sdkHandle);
    sdkHandle.dispose();

    // 3. Evaluate the module code
    const transformedCode = moduleCode.replace(/export\s+default\s+/, "globalThis.__module = ");
    const evalCodeResult = vm.evalCode(transformedCode);
    if (evalCodeResult.error) {
      const errStr = vm.dump(evalCodeResult.error);
      evalCodeResult.error.dispose();
      throw new Error(`Compile error: ${errStr}`);
    }
    evalCodeResult.value.dispose();

    // Call the run function
    const runResult = vm.evalCode(`
      (function() {
        if (!globalThis.__module || typeof globalThis.__module.run !== 'function') {
          throw new Error('Module must export default with run() function');
        }
        return globalThis.__module.run({ inputs: globalThis.inputs, sdk: globalThis.sdk });
      })()
    `);

    if (runResult.error) {
      const errStr = vm.dump(runResult.error);
      runResult.error.dispose();
      throw new Error(`Run initialization error: ${errStr}`);
    }

    const valueHandle = runResult.value;

    // Check if the returned value is a promise
    // In quickjs-emscripten context: checking isPromise via resolving
    const nativePromise = vm.resolvePromise(valueHandle);
    valueHandle.dispose();

    const promiseResolvedValueHandle = await new Promise<any>((resolve, reject) => {
      const check = () => {
        vm.runtime.executePendingJobs();
      };
      const interval = setInterval(check, 2);

      nativePromise
        .then((resolvedVal) => {
          clearInterval(interval);
          resolve(resolvedVal);
        })
        .catch((err) => {
          clearInterval(interval);
          reject(err);
        });
    });

    if (promiseResolvedValueHandle.error) {
      const errorStr = vm.dump(promiseResolvedValueHandle.error);
      promiseResolvedValueHandle.error.dispose();
      throw new Error(`Promise execution rejected: ${errorStr}`);
    }

    const finalVal = vm.dump(promiseResolvedValueHandle.value);
    promiseResolvedValueHandle.value.dispose();
    return String(finalVal);
  } finally {
    vm.dispose();
  }
}
