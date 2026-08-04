# NowBuy Workspace

## Overview

NowBuy is an AI-powered Nigerian e-commerce platform. It uses a pnpm monorepo with TypeScript, NGN currency throughout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4
- **Routing**: Wouter
- **AI**: OpenAI via Replit AI Integrations (chat assistant)
- **Auth**: Custom cookie-based auth (bcryptjs)
- **Object Storage**: Google Cloud Storage (Replit sidecar)
- **Email**: Resend SDK (`RESEND_API_KEY`), from address `support@nowbuy.com`
- **Payments**: Paystack inline (`PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY`)

## Artifacts

- **storefront** (`/`) — Main NowBuy storefront (React + Vite)
- **api-server** (`/api`) — Express backend API
- **mockup-sandbox** (`/__mockup`) — Design mockup sandbox

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Libraries

- `@workspace/db` — PostgreSQL + Drizzle schema (users, products, orders, cart, chat, password-reset, notifications, support_tickets)
- `@workspace/api-zod` — Zod validation schemas (generated from OpenAPI spec)
- `@workspace/api-client-react` — React Query hooks (generated from OpenAPI spec)
- `@workspace/integrations-openai-ai-server` — Server-side OpenAI SDK client
- `@workspace/integrations-openai-ai-react` — React hooks for voice/audio

## Database Schema

- `users` — accounts with roles: buyer / admin / pm
- `products` — catalog items with `images[]`, `colors[]`, `productType` (new), `imageUrl`, `tags[]`, `price` (NGN)
- `orders` — purchases with status flow and NGN pricing
- `cart_items` — session-scoped cart
- `chat_messages` — AI assistant history
- `password_reset_codes` — one-time reset codes
- `settings` — key/value store (bank_details)
- `notifications` — per-user in-app notifications (bell icon in header)
- `support_tickets` — customer support requests with admin reply + email flow

## User Roles

- `buyer` — Regular customers
- `admin` — Full admin access (users, orders, catalog, products editor, bank, push notifications, support desk)
- `pm` — Product manager (orders + catalog only)

## Admin Account

- Email: `admin@nowbuy.app`
- Password: `nowbuyadmin1234`

## Admin Routes

- `/admin` — Dashboard
- `/admin/users` — User management
- `/admin/orders` — Order management + status updates (triggers Resend email)
- `/admin/catalog` — Add new product
- `/admin/products` — Edit / delete existing products (images, colors, type)
- `/admin/notifications` — Push notification to all users
- `/admin/support` — Support desk (view tickets, reply via email)
- `/admin/bank` — Bank transfer details
- `/admin/password` — Change admin password

## Payment Methods

- Paystack inline (card)
- Manual bank transfer (details editable by admin at `/admin/bank`)
- Pay on delivery

## Email (Resend)

- Order status changes automatically send a branded email to the customer
- Support ticket replies send an email to the customer
- New support tickets forward to `support@nowbuy.com`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
