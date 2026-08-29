# ADR-0003: Keep bounty rotation duplicated and test agreement

Status: accepted

The browser and Apps Script each compute daily bounty rotation from the shared catalog. They remain
separate because organizers redeploy Apps Script manually; a cross-implementation agreement test
detects drift for every crew without requiring a backend redeploy.
