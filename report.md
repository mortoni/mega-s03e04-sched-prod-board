run: https://github.com/mortoni/mega-s03e04-sched-prod-board/actions/runs/43366233539
ref: rec/step2 (da2458cb8431dce34a60a812e411cd06971e3c4d)
main sha: 64a76d7f45ec9eecf98d10a9dc3cfc6cc5045160
record: success step2
deploy: success
smoke: success
live: https://sched-prod-board.mortoni-alan.workers.dev

## smoke
live build: 64a76d7f45ec9eecf98d10a9dc3cfc6cc5045160 (want 64a76d7f45ec9eecf98d10a9dc3cfc6cc5045160)
video rec/step1.mp4: HTTP/2 200  content-type: video/mp4 
video rec/step2.mp4: HTTP/2 200  content-type: video/mp4 

## recorder
00:00 open-board: goto {"url":"https://sched-prod-board.mortoni-alan.workers.dev/"}
00:00 loader visible {"loaderSeen":true}
00:01 incidents on screen, loader gone {"rows":8,"sha":"64a76d7f45ec9eecf98d10a9dc3cfc6cc5045160","footerSha":"64a76d7f45ec9eecf98d10a9dc3cfc6cc5045160"}
00:10 watch-board: new incident on top without reload {"before":"INC-1332","now":"INC-4352"}
00:13 ack-incident: pointer on Ack {"aimed":"INC-9173"}
00:20 refresh inserts a new incident on top; rows move down under the pointer {"before":"INC-4352","now":"INC-6103"}
00:21 ack-incident: click, pointer never moved {"aimed":"INC-9173"}
00:21 confirm opens and names the row the click landed on {"confirm":"Ack INC-7471? booking-api · ap-southeast · webhook retries piling up Cancel Ack","aimed":"INC-9173","rowThatSlidUnder":"INC-7471"}
00:25 cancelled: no ack sent {"acksSent":0,"acked":[]}
00:27 confirm names the intended incident {"confirm":"Ack INC-9173? studio-search · ap-southeast · export job stuck in queue Cancel Ack","aimed":"INC-9173"}
00:30 confirm-ack clicked {"aimed":"INC-9173"}
00:30 acked as aimed {"aimed":"INC-9173","acked":["INC-9173"],"ack":{"at":"00:30","id":"INC-9173","ackedAt":"2026-11-13T04:34:01.472Z","receipt":"a1.D96pZtjA5gaBAsaf.M9SgC_GyDa-6Rz-zGmmIGTAFS90lc_b-dWvi2UyGUz1LI9IH1DOcGi-Xbt9kS_EFB7yQ3EMmVZZtdx75mCZuC3YInjzGrDeW3W1_kjZry4CAldC2hPtSCSKs8rUN_Rym2qxq6nSk-_Au3_NQMEgnX72xwlJC8bc0FqtB12wDPtgKLvKklygrFpaFn6pPxNzbU2g"}}
00:34 end 
done { sha: '64a76d7f45ec9eecf98d10a9dc3cfc6cc5045160', acks: 1 }

## deploy log (tail)

 ⛅️ wrangler 4.161.0
────────────────────
🌀 Building list of assets...
✨ Read 8 files from the assets directory /home/runner/work/mega-s03e04-sched-prod-board/mega-s03e04-sched-prod-board/main/dist
🌀 Starting asset upload...
🌀 Found 1 new or modified static asset to upload. Proceeding with upload...
+ /rec/step2.mp4
Uploaded 1 of 1 asset
✨ Success! Uploaded 1 file (6 already uploaded) (1.17 sec)

Total Upload: 0.34 KiB / gzip: 0.25 KiB
Uploaded sched-prod-board (3.33 sec)
Deployed sched-prod-board triggers (0.52 sec)
  https://sched-prod-board.mortoni-alan.workers.dev
Current Version ID: 541106b0-fb77-43c6-b444-e07474821183

Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md
