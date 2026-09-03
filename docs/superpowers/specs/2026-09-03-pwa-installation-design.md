# PockeLog PWA 설치 기반 설계

- 문서 상태: 사용자 승인 완료 설계안
- 작성일: 2026-09-03
- 기준 커밋: `e369d91` (`main`, `origin/main`)
- 대상 환경: 모바일 Safari·Chromium, 데스크톱 Chromium 계열 브라우저

## 1. 목적과 성공 기준

PockeLog를 브라우저의 기본 설치 UI로 모바일 홈 화면과 PC에 설치할 수 있게 한다. 설치 후에는 브라우저 탭이 아닌 독립 창의 `standalone` 모드로 실행하며, 로그인과 기존 가계부 기능은 웹에서와 동일하게 동작해야 한다.

다음 조건을 모두 만족하면 완료로 본다.

- 브라우저가 읽을 수 있는 유효한 웹 앱 manifest가 제공된다.
- 모바일과 PC 설치 화면에 사용할 192px·512px 일반 아이콘과 maskable 아이콘이 제공된다.
- iOS 홈 화면용 Apple touch icon과 브라우저용 PockeLog 아이콘이 제공된다.
- 설치 앱은 `/ledger`에서 시작하고 인증되지 않은 사용자는 기존 인증 흐름으로 로그인한 뒤 돌아온다.
- 앱 이름, 설명, 테마 색상, Apple standalone 메타데이터가 Next.js Metadata API로 출력된다.
- 서비스 워커는 공개 정적 자산만 캐시하며 HTML, RSC, API, 인증, 사용자 데이터 응답은 Cache Storage에 넣지 않는다.
- 기존 단위 테스트, 타입 검사, 린트, 프로덕션 빌드와 공개 PWA E2E 검사가 통과한다.

## 2. 검토한 구현 방식

### 2.1 선택: Next.js 네이티브 manifest와 경량 서비스 워커

`src/app/manifest.ts`와 정적 아이콘을 사용하고, 저장소가 직접 관리하는 작은 서비스 워커를 등록한다. 캐시 허용 대상을 명시적인 경로 목록으로 제한할 수 있어 민감한 가계부 데이터가 오프라인 저장소에 들어가지 않는다는 점을 코드와 테스트에서 확인할 수 있다. 추가 런타임 의존성이 없고 현재 App Router 구조에도 가장 작게 결합된다.

### 2.2 대안: manifest와 아이콘만 제공

가장 단순하고 일부 최신 브라우저에서는 설치 가능하지만, 저장소의 기존 제품 설계가 요구한 정적 자산 캐시 기반을 충족하지 못한다. 서비스 워커 응답 헤더와 업데이트 정책을 명시적으로 관리할 수도 없어 선택하지 않는다.

### 2.3 대안: Serwist 기반 전체 PWA

빌드 시 precache 목록과 오프라인 라우팅을 자동화하기 좋지만, 이번 범위에는 필요하지 않은 의존성과 캐시 규칙이 추가된다. 서버 렌더링된 사용자별 HTML이나 RSC 응답을 실수로 캐시할 위험과 검증 범위도 커지므로 오프라인 기능이 필요한 후속 단계까지 도입을 미룬다.

## 3. manifest와 실행 방식

Next.js 16.3.3의 App Router 파일 규칙에 맞춰 `src/app/manifest.ts`가 타입 안전한 `MetadataRoute.Manifest`를 반환한다.

- `id`: `/`
- `name`, `short_name`: `PockeLog`
- `description`: 기존 `PRODUCT_DESCRIPTION`
- `start_url`: `/ledger`
- `scope`: `/`
- `display`: `standalone`
- `background_color`: 현재 앱 배경색 `#f8faf9`
- `theme_color`: 브랜드 강조색 `#059669`
- `lang`: `ko`
- `categories`: `finance`, `productivity`

manifest에는 192×192와 512×512 PNG를 일반(`any`) 아이콘과 maskable 아이콘으로 각각 선언한다. 설치 앱을 실행하면 `/ledger`를 요청하며, 로그인하지 않은 경우 기존 proxy가 `/login`으로 보내고 로그인 후 원래 경로로 복귀시키는 현재 동작을 그대로 사용한다.

## 4. 아이콘과 메타데이터

아이콘은 현재 UI의 emerald·slate 색상을 사용한 단순한 PockeLog 표식으로 만든다. 둥근 emerald 바탕 안에 흰색 장부와 기록 선을 배치해 작은 크기에서도 식별되게 하고, maskable 변형은 핵심 표식을 중앙 안전 영역 안에 둔다.

저장소에는 다음 정적 산출물을 둔다.

- manifest용 일반 아이콘: 192×192, 512×512 PNG
- manifest용 maskable 아이콘: 192×192, 512×512 PNG
- iOS용 Apple touch icon: 180×180 PNG
- 브라우저와 Next.js 파일 기반 메타데이터용 아이콘

루트 layout의 Metadata에는 `applicationName`, `appleWebApp`, 전화번호 자동 링크 방지 설정을 추가한다. 테마 색상은 Next.js 14부터 metadata의 `themeColor`가 폐기됐으므로 별도의 정적 `Viewport` export로 설정한다. manifest 링크와 파일 기반 아이콘 링크는 Next.js가 자동 생성하게 하여 수동 `<head>` 태그 중복을 피한다.

별도의 앱 내부 설치 버튼이나 자체 팝업은 만들지 않는다. Android·PC Chromium은 브라우저의 설치 UI를 사용하고, iOS는 Safari 공유 메뉴의 홈 화면 추가 기능을 사용한다.

## 5. 서비스 워커와 캐시 정책

루트 layout에 작은 Client Component를 한 번 마운트한다. 프로덕션 환경이고 `navigator.serviceWorker`를 지원할 때만 `/sw.js`를 `/` scope, `updateViaCache: "none"`으로 등록한다. 등록 실패는 로그인이나 화면 렌더링을 막지 않으며 민감 정보가 없는 경고만 브라우저 콘솔에 남긴다.

서비스 워커의 캐시 정책은 allowlist 방식이다.

- 설치 시 manifest 아이콘과 공개 앱 아이콘만 precache한다.
- 런타임에는 같은 origin의 `/_next/static/` 아래 GET 요청과 명시된 공개 아이콘 요청만 Cache Storage에 저장한다.
- 캐시에는 성공한 응답만 저장한다.
- 새 서비스 워커 활성화 시 현재 버전이 아닌 PockeLog 정적 캐시를 삭제한다.
- document navigation, `/api/`, `/auth/`, `/ledger`, `/statistics`, `/tax-goals`, `/settings`, RSC 요청, Server Action, POST·PUT·PATCH·DELETE 요청에는 `respondWith`를 호출하지 않는다. 따라서 이 응답들은 브라우저의 정상 네트워크 흐름만 사용하고 Cache Storage에 복사되지 않는다.
- 오프라인 거래 조회·작성·수정·삭제와 오프라인 HTML fallback은 제공하지 않는다.

`next.config.ts`는 `/sw.js`에 다음 응답 헤더를 고정한다.

- `Content-Type: application/javascript; charset=utf-8`
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Content-Security-Policy: default-src 'self'; script-src 'self'`
- `X-Content-Type-Options: nosniff`

proxy matcher에서는 `sw.js`와 `manifest.webmanifest`를 인증 세션 갱신 대상에서 제외한다. 이렇게 하면 정적 설치 기반 요청이 Supabase 환경 설정이나 사용자 쿠키에 의존하지 않는다.

## 6. 오류 처리와 업데이트

서비스 워커를 지원하지 않는 브라우저는 기존 웹 앱으로 그대로 동작한다. 등록 실패도 앱 기능에는 영향을 주지 않는다. 정적 자산을 네트워크에서 가져오지 못하면 해당 요청만 실패하며 사용자 데이터를 대신 보여 주거나 오래된 HTML로 폴백하지 않는다.

캐시 이름에는 버전을 포함한다. 캐시 정책이나 고정 자산이 바뀌면 버전을 올리고, activate 단계에서 이전 PockeLog 캐시를 제거한다. 서비스 워커 파일 자체는 항상 재검증되므로 배포 후 새 정책을 받을 수 있다.

## 7. 테스트와 검증

TDD 순서로 먼저 다음 실패 테스트를 추가한다.

- manifest가 이름, `/ledger` 시작 경로, `standalone`, 테마, 일반·maskable 192px·512px 아이콘을 선언한다.
- 루트 metadata와 viewport가 앱 이름, Apple standalone, 전화번호 자동 링크 방지, 테마 색상을 선언한다.
- 서비스 워커 등록 모듈은 지원되는 프로덕션 환경에서 올바른 URL·scope·업데이트 정책으로 한 번 등록하고, 미지원 또는 개발 환경에서는 등록하지 않는다.
- 서비스 워커 원본의 캐시 허용 규칙은 `/_next/static/`과 공개 아이콘만 허용하며 document·API·인증·사용자 경로를 캐시하지 않는다.
- Next 설정이 서비스 워커 보안·재검증 헤더를 제공하고 proxy matcher가 PWA 기반 파일을 제외한다.

공개 E2E 검사는 데스크톱과 모바일 Chromium에서 `/manifest.webmanifest`, 서비스 워커 응답 헤더, 아이콘 응답과 루트 페이지의 관련 메타데이터를 확인한다. 최종 검증은 단위 테스트 전체, TypeScript 검사, ESLint, 프로덕션 빌드, 공개 E2E 순서로 실행한다. 실제 Supabase 데이터를 변경하는 통합 E2E는 기존 안전 장치와 환경변수가 없으면 계속 건너뛴다.

## 8. 범위 제외

- 커스텀 설치 버튼·배너와 `beforeinstallprompt` 처리
- 푸시 알림
- 오프라인 사용자 데이터 조회·편집
- background sync 또는 충돌 해결
- 사용자별 HTML·RSC·API 응답 캐시
- 앱 스토어 패키징
