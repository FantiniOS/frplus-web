import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const token = request.cookies.get('auth_token')?.value

    if (!token && (pathname.startsWith('/dashboard') || pathname.startsWith('/captacao'))) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    if (token) {
        try {
            // We do a simple parse of the JWT payload since we can't use jsonwebtoken in edge runtime
            const payloadBase64 = token.split('.')[1]
            if (payloadBase64) {
                const payload = JSON.parse(atob(payloadBase64))
                const role = payload.role?.toUpperCase()

                // Prevent Vendedor from accessing dashboard
                if (pathname.startsWith('/dashboard') && role === 'VENDEDOR') {
                    return NextResponse.redirect(new URL('/captacao', request.url))
                }

                // Prevent Admin from accessing captacao (optional, but good practice)
                if (pathname.startsWith('/captacao') && role !== 'VENDEDOR') {
                    return NextResponse.redirect(new URL('/dashboard', request.url))
                }
                
                // Redirect away from login if already authenticated
                if (pathname === '/' || pathname === '/login') {
                    if (role === 'VENDEDOR') {
                        return NextResponse.redirect(new URL('/captacao', request.url))
                    } else {
                        return NextResponse.redirect(new URL('/dashboard', request.url))
                    }
                }
            }
        } catch (error) {
            // Se houver erro no token, limpa e manda pro login
            const response = NextResponse.redirect(new URL('/', request.url))
            response.cookies.delete('auth_token')
            return response
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/', '/login', '/dashboard/:path*', '/captacao/:path*']
}
