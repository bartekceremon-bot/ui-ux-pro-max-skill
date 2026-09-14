#!/usr/bin/env python3
"""Post-export sanity check for the built APK.

Godot 4.4's Android runtime calls Vibrator.vibrate() without catching
SecurityException, so shipping an APK whose manifest is missing VIBRATE makes
the app die the first time the player taps. This asserts the permissions the
game actually uses are declared, and fails the build if they are not.

Usage: python3 tools/check_apk.py build/PrismRun.apk
"""
import re
import sys
import zipfile

REQUIRED_PERMISSIONS = ["android.permission.VIBRATE"]


def manifest_strings(apk_path):
    with zipfile.ZipFile(apk_path) as z:
        raw = z.read("AndroidManifest.xml")
    # Binary AXML stores its string pool as UTF-16LE; fall back to latin-1 so a
    # UTF-8 pool is still searchable.
    text = raw.decode("utf-16-le", errors="ignore") + raw.decode("latin-1", errors="ignore")
    return text


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    apk = sys.argv[1]
    text = manifest_strings(apk)
    found = sorted(set(re.findall(r"android\.permission\.[A-Z_]+", text)))
    print("APK:", apk)
    print("Declared permissions:", ", ".join(found) or "(none)")

    missing = [p for p in REQUIRED_PERMISSIONS if p not in found]
    if missing:
        print("FAIL: missing required permissions: " + ", ".join(missing), file=sys.stderr)
        print("Set the matching permissions/* option in export_presets.cfg.", file=sys.stderr)
        return 1

    with zipfile.ZipFile(apk) as z:
        names = z.namelist()
    if not any(n.startswith("lib/") and n.endswith("libgodot_android.so") for n in names):
        print("FAIL: no Godot native library in the APK", file=sys.stderr)
        return 1
    if "assets/_cl_" not in names and not any(n.endswith(".pck") for n in names) \
            and not any(n.startswith("assets/") for n in names):
        print("FAIL: no game data in the APK", file=sys.stderr)
        return 1

    print("PASS: APK looks shippable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
