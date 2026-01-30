# Unstable Stealth - Scramjet Web Proxy

## Overview

This is a web proxy application built on top of Scramjet, a high-performance interception-based web proxy. The application allows users to browse websites through a proxy layer, bypassing internet restrictions. It's designed as a minimalist, stealth-focused proxy demo with support for major websites including Google, YouTube, Discord, Twitter, Instagram, Spotify, Reddit, and GeForce NOW.

The project consists of a Fastify-based Node.js server that serves static files and handles WebSocket connections for the Wisp protocol, which enables the proxy functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Server Architecture
- **Framework**: Fastify v5.x with a custom HTTP server factory
- **Static File Serving**: @fastify/static plugin serves multiple static directories
- **WebSocket Handling**: Custom upgrade handler routes WebSocket connections to Wisp server
- **Security Headers**: Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers are set for all requests to enable SharedArrayBuffer support required by the proxy

### Proxy Technology Stack
- **Scramjet**: Core proxy engine that intercepts and rewrites web requests
- **BareMux**: Connection management layer for bare server protocol
- **Wisp Protocol**: WebSocket-based protocol for tunneling HTTP requests
- **libcurl-transport**: Alternative transport layer using libcurl

### Frontend Architecture
- **Service Worker**: Registers a service worker (sw.js) that intercepts fetch requests and routes them through Scramjet
- **ScramjetController**: Client-side JavaScript controller that initializes the proxy and manages iframe-based browsing
- **Search Handling**: URL/search query parser that determines whether input is a URL or search term

### Static File Routes
- `/` - Public directory (HTML, CSS, JS)
- `/scram/` - Scramjet core files (WASM, JS bundles)
- `/baremux/` - BareMux worker and connection files
- `/libcurl/` - libcurl transport files

### DNS and Filtering Configuration
- Custom DNS servers: Cloudflare family-safe (1.1.1.3, 1.0.0.3)
- Hostname blacklist support via regex patterns
- UDP streams disabled by default

## External Dependencies

### NPM Packages
- **@mercuryworkshop/scramjet**: Core proxy engine (loaded from GitHub releases)
- **@mercuryworkshop/bare-mux**: Bare server multiplexer for connection management
- **@mercuryworkshop/wisp-js**: WebSocket-based tunneling protocol server
- **@mercuryworkshop/libcurl-transport**: Alternative HTTP transport using libcurl/WASM
- **ws**: WebSocket library for Node.js

### Runtime Requirements
- Node.js 16.x or higher
- pnpm package manager (v10.18.3 specified)

### External Services
- Google Fonts API for Roboto font family
- No database required - this is a stateless proxy application