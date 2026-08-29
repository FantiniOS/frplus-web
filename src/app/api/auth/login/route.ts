import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

// POST /api/auth/login - Login do usuário
export async function POST(request: Request) {
    try {
        const { identifier, senha } = await request.json()

        if (!identifier || !senha) {
            return NextResponse.json(
                { error: 'Usuário e senha são obrigatórios' },
                { status: 400 }
            )
        }

        // Tentar buscar como Vendedor primeiro se for formato numérico (ou apenas tenta)
        const vendedor = await prisma.vendedor.findFirst({
            where: { codigoAcesso: identifier }
        })

        if (vendedor) {
            if (!vendedor.ativo) {
                return NextResponse.json({ error: 'Vendedor desativado.' }, { status: 401 })
            }
            
            // Verifica senha - como não especificamos se o vendedor terá hash, 
            // vamos checar se é hash (bcrypt) ou texto plano, mas preferencialmente bcrypt ou plano
            let senhaValida = false;
            if (vendedor.senha) {
                if (vendedor.senha.startsWith('$2')) {
                    senhaValida = await bcrypt.compare(senha, vendedor.senha);
                } else {
                    senhaValida = vendedor.senha === senha;
                }
            }
            
            if (!senhaValida) {
                return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
            }

            const token = jwt.sign(
                {
                    id: vendedor.id,
                    username: vendedor.codigoAcesso,
                    nome: vendedor.nome,
                    role: vendedor.role || 'VENDEDOR'
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            )

            const response = NextResponse.json({
                usuario: {
                    id: vendedor.id,
                    nome: vendedor.nome,
                    username: vendedor.codigoAcesso,
                    email: vendedor.email,
                    empresa: null,
                    role: vendedor.role || 'VENDEDOR',
                    fabricaId: null
                },
                token
            })

            response.cookies.set('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7 // 7 dias
            })

            return response;
        }

        // Buscar usuário pelo username ou email (case insensitive)
        const usuario = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { username: { equals: identifier, mode: 'insensitive' } },
                    { email: { equals: identifier, mode: 'insensitive' } }
                ]
            }
        })

        if (!usuario) {
            return NextResponse.json(
                { error: 'Credenciais inválidas' },
                { status: 401 }
            )
        }

        // Verificar se está ativo
        if (!usuario.ativo) {
            return NextResponse.json(
                { error: 'Usuário desativado. Contate o administrador.' },
                { status: 401 }
            )
        }

        // Verificar senha
        const senhaValida = await bcrypt.compare(senha, usuario.senha)

        if (!senhaValida) {
            return NextResponse.json(
                { error: 'Credenciais inválidas' },
                { status: 401 }
            )
        }

        // Gerar token JWT
        const token = jwt.sign(
            {
                id: usuario.id,
                username: usuario.username,
                nome: usuario.nome,
                role: usuario.role,
                fabricaId: usuario.fabricaId
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        // Retornar usuário (sem senha) e token
        const response = NextResponse.json({
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                username: usuario.username,
                email: usuario.email,
                empresa: usuario.empresa,
                role: usuario.role,
                fabricaId: usuario.fabricaId
            },
            token
        })

        // Set cookie
        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 dias
        })

        return response
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
    }
}
