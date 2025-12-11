# ai-service

An Express microservice that reads Excel files, converts rows into push payloads, and can optionally dispatch them to a webhook.

## Setup
- Install deps: `npm install`
- Configure env: copy `.env.example` to `.env` and set values (port, webhook URL/token if you want auto dispatch).

## Run
- Dev mode with restart: `npm run dev`
- Prod: `npm start`
- Health check: `GET /health`

## API
### `POST /push/from-excel`
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: required Excel file (`.xlsx`, `.xls`, `.csv`)
  - `dispatch`: optional (`true`/`false`). Falls back to `DEFAULT_DISPATCH` env when omitted.
- Response:
  - `sheetName`, `totalRows`, `parsedCount`
  - `pushes`: normalized push payloads (`title`, `body`, `audience`, `sendAt`, `rowNumber`)
  - `dispatch`: what happened with webhook dispatch (sent/skipped/failed per row)

### Excel format
- First row should contain headers.
- Recognized headers (case-insensitive): `title`/`标题`, `body`/`content`/`内容`, `audience`/`target`/`recipient`, `sendAt`/`发送时间`.
- Rows missing both `title` and `body` are ignored. `audience` defaults to `all`. `sendAt` is returned as ISO time if it can be parsed.

## Example request
```bash
curl -X POST "http://localhost:4100/push/from-excel?dispatch=false" \
  -F "file=@./examples/push.xlsx"
```
