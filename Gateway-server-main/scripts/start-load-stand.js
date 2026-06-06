const { spawn } = require("child_process");

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const children = [];

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: options.shell || false,
    windowsHide: true,
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      process.exitCode = code;
      stopChildren();
    }
  });

  return child;
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});

startProcess(npxCommand, [
  "mb",
  "start",
  "--configfile",
  "load-tests/mountebank/imposters.json",
  "--nologfile",
], { shell: process.platform === "win32" });

startProcess(process.execPath, ["src/server.js"]);
