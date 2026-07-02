# Paper

돈은 가짜인데 마음은 진짜로 흔들리는 교육용 모의투자 시뮬레이터입니다.

국내 주식과 NASDAQ 종목을 검색하고, 현재가와 차트를 보면서, 가상 현금으로 매수/매도를 해볼 수 있습니다. 아직 AI는 옆에서 팔짱 끼고 기다리는 중입니다. 일단 사람부터 제대로 주문 넣게 만들고 있습니다.

## 지금 되는 것

- 국내 시총 상위 100개 + NASDAQ 시총 상위 100개 자산 마스터
- 한글/영문/종목코드 기반 종목 검색
- Yahoo Finance 기반 현재가, 등락률, 거래량, 시가/고가/저가 조회
- 1분, 1시간, 1일 단위 차트
- 차트 주기별 자동 갱신
- 가상 현금 기반 매수/매도
- 포트폴리오, 보유 종목, 거래 내역 저장
- Next.js App Router + React Query 기반 프론트 데이터 흐름
- Prisma + SQLite 로컬 DB

## 아직 안 되는 것

- AI 시장 브리핑
- AI와 모의투자 대결
- 랭킹 시스템
- 주문 유형 고도화
- 진짜 돈 벌기

마지막 항목은 구현 예정이 아닙니다. 구현되면 그건 서비스가 아니라 사건입니다.

## 기술 스택

- Package manager: pnpm workspace
- Web: Next.js App Router, React, TypeScript, TanStack Query
- Chart: lightweight-charts
- API: NestJS, TypeScript
- DB: Prisma, SQLite
- Market data: yahoo-finance2
- Shared: workspace 공통 타입 패키지

## 프로젝트 구조

```txt
apps/
  api/        NestJS API server
  web/        Next.js web client
packages/
  shared/     Shared domain types
```

## 시작하기

```bash
pnpm install
pnpm dev
```

기본 주소는 아래와 같습니다.

```txt
API  http://localhost:4000
Web  http://localhost:3000
```

## DB 준비

Prisma Client 생성:

```bash
pnpm --filter @githubwatch/api prisma:generate
```

자산 마스터 seed:

```bash
pnpm --filter @githubwatch/api db:seed:assets
```

현재 seed는 국내 시총 상위 100개와 NASDAQ 시총 상위 100개를 넣습니다. NASDAQ 종목은 Yahoo Finance에서 실제 quote 조회가 되는 종목만 남깁니다. 이상한 종목이 끼어들면 시장 데이터의 세계가 잠깐 기침한 겁니다.

## 주의사항

이 프로젝트는 교육용 paper trading 앱입니다.

Yahoo Finance 데이터는 거래소/종목에 따라 지연되거나 누락될 수 있습니다. 이 앱이 매수 버튼을 예쁘게 보여준다고 해서 실제 투자 조언을 하는 것은 아닙니다. 

그렇지만 여기서 내 계좌가 녹지않는다 해서 진짜 주식 계좌가 녹지않을꺼란 보장은 없습니다...

주가 데이터는 진짜고 계좌만 가짜입니다 정신 차리세요..
