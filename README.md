# PockeLog

혼자 또는 여러 사용자가 개인·공동 장부를 관리하는 반응형 가계부입니다. Next.js App Router로 만들고 Vercel에 배포하며, 인증과 데이터는 Supabase를 사용합니다.

## 로컬 실행

Node.js 20.9 이상과 npm이 필요합니다.

```bash
npm install
copy .env.example .env.local
npm run dev
```

`.env.local`에 다음 값을 입력합니다.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 브라우저용 publishable key
- `SUPABASE_SECRET_KEY`: 서버 전용 secret key
- `NEXT_PUBLIC_APP_URL`: 로컬에서는 `http://localhost:3000`, 운영에서는 Vercel 도메인

실제 키가 들어 있는 `.env*` 파일은 Git에 커밋하지 않습니다.

## 품질 검사

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

제품 설계와 구현 계획은 `docs/superpowers/`에서 관리합니다.
