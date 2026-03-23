'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

export type ChartViewMode = 'Mensal' | 'Anual' | 'Global'

export interface ChartDataResponse {
    date: string       // YYYY-MM-DD (texto puro, SEM timezone)
    dayLabel: string   // Label do eixo X (dia, mês abreviado, ou ano)
    value: number
    dayOfWeek?: number // 0=Dom, 1=Seg... 6=Sáb (calculado via UTC, sem conversão)
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
    const nowYear = now.getUTCFullYear()
    const nowMonth = now.getUTCMonth()

    // ──────────────────────────────────────
    // MENSAL: Agrupa valorTotal por DIA
    // ──────────────────────────────────────
    if (view === 'Mensal') {
        const year = yearParam || nowYear
        const month = monthParam !== null && monthParam !== undefined ? monthParam : nowMonth

        // Datas salvas como meia-noite UTC → filtro direto em UTC
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
            // MÉTODO UTC — sem conversão de fuso
            const dia = o.data.getUTCDate()
            dailyMap.set(dia, (dailyMap.get(dia) || 0) + Number(o.valorTotal))
        })

        const result: ChartDataResponse[] = []
        for (let day = 1; day <= days; day++) {
            const d = new Date(Date.UTC(year, month, day))
            const mm = String(month + 1).padStart(2, '0')
            const dd = String(day).padStart(2, '0')
            result.push({
                date: `${year}-${mm}-${dd}`,           // Texto puro YYYY-MM-DD
                dayLabel: String(day),
                value: dailyMap.get(day) || 0,
                dayOfWeek: d.getUTCDay()                // 0=Dom via UTC, correto
            })
        }
        return result
    }

    // ──────────────────────────────────────
    // ANUAL: Agrupa valorTotal por MÊS
    // ──────────────────────────────────────
    if (view === 'Anual') {
        const year = yearParam || nowYear

        const startUTC = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
        const endUTC = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))

        whereClause.data = { gte: startUTC, lt: endUTC }

        const orders = await prisma.pedido.findMany({
            where: whereClause,
            select: { data: true, valorTotal: true }
        })

        const monthlyMap = new Map<number, number>()
        orders.forEach(o => {
            // MÉTODO UTC — sem conversão de fuso
            const mes = o.data.getUTCMonth()
            monthlyMap.set(mes, (monthlyMap.get(mes) || 0) + Number(o.valorTotal))
        })

        const monthsStr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const result: ChartDataResponse[] = []
        for (let m = 0; m < 12; m++) {
            const mm = String(m + 1).padStart(2, '0')
            result.push({
                date: `${year}-${mm}-01`,
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
        let minYear = nowYear
        let maxYear = minYear

        orders.forEach(o => {
            // MÉTODO UTC — sem conversão de fuso
            const y = o.data.getUTCFullYear()
            if (y < minYear) minYear = y
            if (y > maxYear) maxYear = y
            yearlyMap.set(y, (yearlyMap.get(y) || 0) + Number(o.valorTotal))
        })

        const result: ChartDataResponse[] = []
        for (let y = minYear; y <= maxYear; y++) {
            result.push({
                date: `${y}-01-01`,
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
        years.add(o.data.getUTCFullYear())
    })

    return Array.from(years).sort((a, b) => b - a)
}
