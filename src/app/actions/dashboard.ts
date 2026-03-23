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
// STRING SLICE — Ignora timezone completamente.
// As datas do Prisma são salvas como meia-noite UTC
// (ex: "2026-03-23T00:00:00.000Z"). O dia 23 JÁ É o
// dia correto. Qualquer conversão de fuso RETROCEDE
// a data. Por isso, recortamos a string ISO pura.
// ══════════════════════════════════════════════════════
function getDateParts(date: Date) {
    const iso = date.toISOString() // "2026-03-23T00:00:00.000Z"
    const dateOnly = iso.split('T')[0]  // "2026-03-23"
    const [yearStr, monthStr, dayStr] = dateOnly.split('-')
    return {
        year: parseInt(yearStr, 10),
        month: parseInt(monthStr, 10) - 1, // 0-indexed (JS convention)
        day: parseInt(dayStr, 10)
    }
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
    const nowParts = getDateParts(now)

    // ──────────────────────────────────────
    // MENSAL: Agrupa valorTotal por DIA
    // ──────────────────────────────────────
    if (view === 'Mensal') {
        const year = yearParam || nowParts.year
        const month = monthParam !== null && monthParam !== undefined ? monthParam : nowParts.month

        // Datas salvas como meia-noite UTC → filtramos diretamente em UTC
        const startUTC = new Date(Date.UTC(year, month, 1, 0, 0, 0))
        const endUTC = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0))

        whereClause.data = { gte: startUTC, lt: endUTC }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const days = getDaysInMonth(year, month)
        const dailyMap = new Map<number, number>()

        orders.forEach(o => {
            const { day } = getDateParts(o.data)
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
        const year = yearParam || nowParts.year

        const startUTC = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
        const endUTC = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))

        whereClause.data = { gte: startUTC, lt: endUTC }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const monthlyMap = new Map<number, number>()
        orders.forEach(o => {
            const { month: m } = getDateParts(o.data)
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
        let minYear = nowParts.year
        let maxYear = minYear

        orders.forEach(o => {
            const { year: y } = getDateParts(o.data)
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
        const { year } = getDateParts(o.data)
        years.add(year)
    })

    return Array.from(years).sort((a, b) => b - a) // desc
}
