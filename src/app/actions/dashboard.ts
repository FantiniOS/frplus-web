'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

export type ChartViewMode = 'Mensal' | 'Anual' | 'Global'

export interface ChartDataResponse {
    date: string
    dayLabel: string
    value: number
}

// ══════════════════════════════════════════════════════
// TIMEZONE FIX: Converte data UTC do Prisma para BRT (UTC-3)
// Garante que um pedido feito às 00:00 BRT (03:00 UTC) 
// não caia no dia anterior ao agrupar.
// ══════════════════════════════════════════════════════
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000 // UTC-3

function toBRT(utcDate: Date): Date {
    return new Date(utcDate.getTime() + BRT_OFFSET_MS)
}

// Days in month helper
const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
}

export async function getDashboardChartData(
    view: ChartViewMode,
    yearParam?: number | null,
    monthParam?: number | null
): Promise<ChartDataResponse[]> {
    const user = await getServerUser()
    if (!user) {
        throw new Error('Não autorizado')
    }

    const whereClause: any = {
        status: { notIn: ['Cancelado'] }
    }

    if (user.role === 'industria' && user.fabricaId) {
        whereClause.fabricaId = user.fabricaId
    }

    const now = new Date()
    const nowBRT = toBRT(now)

    // ──────────────────────────────────────
    // MENSAL: Agrupa valorTotal por DIA
    // ──────────────────────────────────────
    if (view === 'Mensal') {
        const year = yearParam || nowBRT.getFullYear()
        const month = monthParam !== null && monthParam !== undefined ? monthParam : nowBRT.getMonth()

        // Intervalo UTC que cobre o mês inteiro em BRT
        // Início do mês em BRT = year-month-01 00:00 BRT = year-month-01 03:00 UTC
        const startUTC = new Date(Date.UTC(year, month, 1, 3, 0, 0))
        const endUTC = new Date(Date.UTC(year, month + 1, 1, 3, 0, 0))

        whereClause.data = { gte: startUTC, lt: endUTC }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const days = getDaysInMonth(year, month)
        const dailyMap = new Map<number, number>()

        orders.forEach(o => {
            const brt = toBRT(o.data)
            const day = brt.getDate()
            dailyMap.set(day, (dailyMap.get(day) || 0) + Number(o.valorTotal))
        })

        const result: ChartDataResponse[] = []
        for (let day = 1; day <= days; day++) {
            result.push({
                date: new Date(Date.UTC(year, month, day)).toISOString(),
                dayLabel: String(day),
                value: dailyMap.get(day) || 0
            })
        }
        return result
    }

    // ──────────────────────────────────────
    // ANUAL: Agrupa valorTotal por MÊS
    // ──────────────────────────────────────
    if (view === 'Anual') {
        const year = yearParam || nowBRT.getFullYear()

        // Intervalo UTC que cobre o ano inteiro em BRT
        const startUTC = new Date(Date.UTC(year, 0, 1, 3, 0, 0))
        const endUTC = new Date(Date.UTC(year + 1, 0, 1, 3, 0, 0))

        whereClause.data = { gte: startUTC, lt: endUTC }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const monthlyMap = new Map<number, number>()
        orders.forEach(o => {
            const brt = toBRT(o.data)
            const m = brt.getMonth()
            monthlyMap.set(m, (monthlyMap.get(m) || 0) + Number(o.valorTotal))
        })

        const monthsStr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const result: ChartDataResponse[] = []
        for (let m = 0; m < 12; m++) {
            result.push({
                date: new Date(Date.UTC(year, m, 1)).toISOString(),
                dayLabel: monthsStr[m],
                value: monthlyMap.get(m) || 0
            })
        }
        return result
    }

    // ──────────────────────────────────────
    // GLOBAL: Agrupa valorTotal por ANO
    // ──────────────────────────────────────
    if (view === 'Global') {
        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true },
            orderBy: { data: 'asc' }
        })

        const yearlyMap = new Map<number, number>()
        let minYear = nowBRT.getFullYear()
        let maxYear = minYear

        orders.forEach(o => {
            const brt = toBRT(o.data)
            const y = brt.getFullYear()
            if (y < minYear) minYear = y
            if (y > maxYear) maxYear = y
            yearlyMap.set(y, (yearlyMap.get(y) || 0) + Number(o.valorTotal))
        })

        const result: ChartDataResponse[] = []
        for (let y = minYear; y <= maxYear; y++) {
            result.push({
                date: new Date(Date.UTC(y, 0, 1)).toISOString(),
                dayLabel: String(y),
                value: yearlyMap.get(y) || 0
            })
        }

        return result
    }

    return []
}

// Helper: retorna os anos disponíveis no histórico de pedidos
export async function getAvailableYears(): Promise<number[]> {
    const user = await getServerUser()
    if (!user) return []

    const whereClause: any = { status: { notIn: ['Cancelado'] } }
    if (user.role === 'industria' && user.fabricaId) {
        whereClause.fabricaId = user.fabricaId
    }

    const orders = await prisma.pedido.findMany({
        where: whereClause,
        select: { data: true },
        orderBy: { data: 'asc' }
    })

    const years = new Set<number>()
    orders.forEach(o => {
        const brt = toBRT(o.data)
        years.add(brt.getFullYear())
    })

    return Array.from(years).sort((a, b) => b - a) // desc
}
