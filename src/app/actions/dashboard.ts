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
// CORREÇÃO DEFINITIVA DE TIMEZONE (Intl nativo)
// Garante o fuso de Brasília considerando o histórico (DST).
// ══════════════════════════════════════════════════════
function getBRTDateDetails(date: Date) {
    // 'en-GB' format is DD/MM/YYYY
    const str = date.toLocaleDateString('en-GB', { timeZone: 'America/Sao_Paulo' })
    const [dayStr, monthStr, yearStr] = str.split('/')
    return {
        day: parseInt(dayStr, 10),
        month: parseInt(monthStr, 10) - 1, // 0-indexed para padronizar com JS
        year: parseInt(yearStr, 10)
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
    const nowBRT = getBRTDateDetails(now)

    // ──────────────────────────────────────
    // MENSAL: Agrupa valorTotal por DIA
    // ──────────────────────────────────────
    if (view === 'Mensal') {
        const year = yearParam || nowBRT.year
        const month = monthParam !== null && monthParam !== undefined ? monthParam : nowBRT.month

        // Construindo as datas de limite de forma nativa considerando UTC-3
        // Para abranger o mês todo em BRT, do dia 1 ao dia 1 do próximo mês.
        // O offset base do Brasil é -3h, logo, 00:00 BRT = 03:00 UTC
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
            const { day, month: oMonth, year: oYear } = getBRTDateDetails(o.data)
            // Agrupa apenas se realmente pertencer ao mês (safety check)
            if (oMonth === month && oYear === year) {
                dailyMap.set(day, (dailyMap.get(day) || 0) + Number(o.valorTotal))
            }
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
        const year = yearParam || nowBRT.year

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
            const { month: m, year: oYear } = getBRTDateDetails(o.data)
            if (oYear === year) {
                monthlyMap.set(m, (monthlyMap.get(m) || 0) + Number(o.valorTotal))
            }
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
        let minYear = nowBRT.year
        let maxYear = minYear

        orders.forEach(o => {
            const { year: y } = getBRTDateDetails(o.data)
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
        const { year } = getBRTDateDetails(o.data)
        years.add(year)
    })

    return Array.from(years).sort((a, b) => b - a) // desc
}
