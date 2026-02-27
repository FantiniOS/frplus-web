import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'frplus_secret_key_2026'

export interface ServerUser {
    id: string;
    nome: string;
    email: string | null;
    role: string;
    fabricaId: string | null;
}

export async function getServerUser(): Promise<ServerUser | null> {
    const cookieStore = cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as ServerUser
        return decoded
    } catch {
        return null
    }
}
