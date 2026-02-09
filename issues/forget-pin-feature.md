### Description:
Currently, users of the authentication app do not have an option to recover their PIN if it is forgotten. This can lead to frustration and lockouts, creating a suboptimal user experience. Implementing a "Forget PIN" feature will allow users to securely reset their PIN and regain access to their accounts.

### Proposed Solution:
1. Add a "Forget PIN" button/link on the login or PIN entry screen.
2. When clicked, guide users through a verification process (e.g., email/phone verification).
3. Allow users to set up a new PIN securely after successful verification.
4. Ensure the feature complies with existing security practices and does not compromise user safety.

### Tasks:
- [ ] Design the user interface for the "Forget PIN" feature.
- [ ] Implement backend logic for verification and PIN reset.
- [ ] Integrate the feature into existing authentication workflows.
- [ ] Write unit and integration tests for the feature.

### Additional Context:
This feature is requested to improve ease of access and solve a common problem where users forget their PINs. Discussion is needed to finalize the verification method (email-based, phone-based, or other).

### References:
N/A

**Created by:** abroa01  
**Created on:** 2026-02-09 01:31:48 (UTC)