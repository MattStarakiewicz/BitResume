// Minimal afterPack hook to set the EXE icon using rcedit, without requiring winCodeSign symlink permissions.
// electron-builder calls this script with `(context)` argument; we patch only Windows targets.

const path = require("path");
const fs = require("fs");

async function main() {
  const context = process.argv[2] ? JSON.parse(process.argv[2]) : null;
  if (!context || !context.appOutDir || context.electronPlatformName !== "win32") {
    return;
  }

  const exeName = context.packager.appInfo.productFilename + ".exe";
  const exePath = path.join(context.appOutDir, exeName);

  const iconCandidates = [
    path.join(context.packager.projectDir, "public", "bitresume-certificate.ico"),
    path.join(context.packager.info.buildResourcesDir, "bitresume-certificate.ico"),
  ];

  let iconPath = null;
  for (const p of iconCandidates) {
    if (fs.existsSync(p)) {
      iconPath = p;
      break;
    }
  }

  if (!iconPath || !fs.existsSync(exePath)) {
    return;
  }

  // Use local rcedit (devDependency) to set the icon resource.
  const rceditPath = require.resolve("rcedit");
  const spawn = require("child_process").spawn;

  await new Promise((resolve) => {
    const child = spawn(process.execPath, [rceditPath, exePath, "--set-icon", iconPath], {
      stdio: "inherit",
    });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}

// electron-builder passes JSON context via env when using string afterPack,
// here we support invocation via manual node call as well.

if (require.main === module) {
  main().catch(() => {
    // best-effort; do not fail the whole build on icon patch issues
  });
}

