# 모의 투자 싸비스

Yahoo Finance 기반 교육용 모의투자 시뮬레이터입니다.

1차 개발 목표는 AI 기능을 제외한 모의투자까지가 MVP 입니다.
2차 개발 목표는 AI 기능을 연동하여 AI와 모의 투자 배틀,AI 일일 조언,내 포트폴리오 분석 등 신기한 기능이 추가 될 예정입니다.

## MVP Scope

- 종목 검색과 관심 종목 등록
- 현재가 조회
- 1m, 5m, 1d 캔들 차트 API
- 가상 현금 기반 시장가 매수/매도
- 보유 포지션, 거래 내역, 포트폴리오 평가
- 가격 데이터 provider 추상화
- quote/candle 캐시와 DB 저장 확장 지점

## TODO

- 한국 종목 마스터 테이블 구축 후 한글 회사명 검색 지원

## Tech Stack

- Package manager: pnpm workspace
- Web: Next.js App Router, TypeScript
- API: NestJS, TypeScript
- Shared: 공통 타입 패키지
- Market data: `yahoo-finance2`
- Future persistence: Prisma/PostgreSQL

## Project Structure

```txt
apps/
  api/        NestJS API server
  web/        Next.js web client
packages/
  shared/     Shared domain types
```

## Getting Started

```bash
pnpm install
pnpm dev
```

API server runs on `http://localhost:4000`.
Web app runs on `http://localhost:3000`.

## Disclaimer

This project is an educational paper trading simulator. Market data is provided via `yahoo-finance2`/Yahoo Finance and may be delayed depending on exchange and symbol. It is not intended for real trading or investment advice.
