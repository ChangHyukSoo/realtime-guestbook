# Profile usability evaluation — T033

Status: Passed. User-provided observations from five actual participants were reviewed on 2026-11-03. T031, T032 and T033 are complete.

Do not record names, email addresses, tokens, signed URLs, or uploaded image bytes.
Use participant IDs P1–P5. Record observations from actual participants only.

## Session setup

- Date / facilitator:
- Environment / deployed revision:
- T031 remote migration evidence: version 202611020001 applied after SQL backups, rollback-only remote rehearsal and privilege postchecks (2026-11-03).
- T032 account A/B integration evidence: 11 checks passed using isolated real accounts; artifacts/hosted-profile-results.json and memory-bank/progress.md. Test accounts were removed.
- Desktop and mobile browsers / viewport sizes:

## Procedure

### 진행자용 안내

- 참여자 5명에게 P1~P5를 부여하고, PC와 실제 모바일 사용자를 모두 포함합니다.
- 각 참여자는 평가 전에 이메일 인증과 로그인을 완료합니다. 측정은 방명록 첫 화면에서 시작하며, 닉네임 변경 위치를 미리 설명하지 않습니다.
- 첫 과제: “내 프로필을 찾아 닉네임을 원하는 값으로 바꾸고 저장해주세요.” 안내를 마친 시점부터 저장 성공 표시까지 초 단위로 측정합니다. 도움을 주었다면 반드시 기록합니다.
- 후속 과제: “프로필을 세 번 변경해주세요. 그중 한 번은 사진 변경을 포함하고, 방명록의 작성자 표시도 확인해주세요.” 각 변경의 성공 여부와 혼란·도움 여부를 기록합니다.
- 처음 과제와 후속 세 번의 변경을 구분하여 기록합니다. 참여자가 중단하거나 저장에 실패한 경우도 결과에 포함합니다.
- 사용한 환경과 코드 버전, 기기·브라우저, 소요 시간, 도움 여부를 아래 표에 기록합니다. 이름·이메일·비밀번호는 기록하지 않습니다.
- SC-001은 5명 중 4명 이상이 도움 없이 120초 이내 첫 과제에 성공해야 통과합니다. SC-005는 5명 중 4명 이상이 혼란 없이 후속 변경 세 번에 모두 성공해야 통과합니다.
- 참여자 결과가 없는 칸은 비워두고, 실제 5명의 관찰을 기록한 뒤 판정합니다.

1. Give each participant access to a prepared member account and the guestbook.
2. Ask them to find their profile, change their nickname, and save without coaching.
3. Measure elapsed time from the instruction to the visible saved state. Record any help provided and whether the task succeeded within two minutes.
4. Ask them to perform three profile changes, including an avatar change, and inspect the resulting author display. Record completion of each change.
5. Record confusion, failures, and participant comments without personal data.

## Observations

| Participant | Device / browser | Nickname task seconds | Unassisted success within 120 s | Change 1 | Change 2 | Change 3 | Confusion / assistance |
|---          |---               |---                    |---                              |---       |---       |---       |---                     |
| P1          | PC/MS Edge 156.0 | 10                    | success                         | success  |  success | success  | none                   |
| P2          | PC/Chrome 156.0  | 12                    | success                         | success  |  success | success  | none                   |
| P3          | PC/Brave 1.98.63 | 11                    | success                         | success  |  success | success  | none                   |
| P4          | Mobile/Chrome 156.0| 15                    | success                         | success  |  success | success  | none                   |
| P5          | Mobile/Chrome 156.0| 20                    | success                         | success  |  success | success  | none                   |

## Acceptance decision

- SC-001: At least 4 of 5 participants complete the nickname change unassisted within two minutes. Result: PASS (5/5; 10, 12, 11, 15 and 20 seconds; all unassisted).
- SC-005: At least 4 of 5 participants complete three profile changes without confusion. Result: PASS (5/5 completed all three changes; 15/15 changes succeeded; no confusion or assistance reported).
- Desktop/mobile coverage: PASS (3 desktop: Edge, Chrome, Brave; 2 mobile: Chrome).
- Findings and follow-up tasks: No usability failures or confusion reported. No implementation follow-up is indicated by these observations. Mean nickname completion time: 13.6 seconds; median: 12 seconds; range: 10-20 seconds.
- Evidence reviewed by / date: Codex / 2026-11-03; actual participant observations supplied by the user.

Evidence limits: Session date/facilitator, deployed revision and viewport sizes were not supplied. The per-change actions and avatar/author-display details are not itemized; the decision uses the supplied success entries under the procedure above. No independent observation of the sessions or new automated/remote checks is claimed. This five-person evaluation supports the specified acceptance thresholds, not broader population estimates.
