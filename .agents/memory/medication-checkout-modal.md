---
name: Medication checkout modal compatibility
description: Compatibility decision for the SugboDoc medication fulfillment checkout surface.
---

Use a native React modal for the medication fulfillment checkout rather than the existing Radix Dialog wrapper.

**Why:** The Radix Dialog path caused a runtime React dispatcher/useRef failure in this project, while the native modal rendered and remained functional.

**How to apply:** Preserve the native modal pattern when extending medication checkout or adding related checkout details; only revisit the dialog dependency after reproducing the issue with the current React/toolchain versions.