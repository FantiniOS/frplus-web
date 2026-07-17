'use server'

import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/getServerUser'

export interface BonificacaoComissaoResult {
    /** Taxa de comissão vigente no período selecionado (em %) */
    taxaPeriodo: number
    /** Comissão sobre bonificações do período selecionado */
    comissaoPeriodo: number
    /** Comissão sobre bonificações do ano inteiro (ponderada por vigência) */
    comissaoAnual: number
}

/**
 * Determina o percentual vigente para uma data, dado o histórico de vigências
 * (ordenado DESC por dataInicio) e o percentual padrão (fallback).
 */
function getPercentualNaData(
    vigencias: { dataInicio: Date; percentual: number }[],
    data: Date,
    percentualPadrao: number
): number {
    for (const v of vigencias) {
        if (v.dataInicio <= data) {
            return v.percentual
        }
    }
    return percentualPadrao
}

/**
 * Busca o vendedor master FANTINI e calcula a comissão sobre bonificações,
 * aplicando a taxa vigente na DATA de cada pedido.
 *
 * Retorna a taxa do período selecionado, comissão do período e comissão anual.
 */
export async function getBonificacaoComissao(
    year: number,
    month?: number | null
): Promise<BonificacaoComissaoResult> {
    const user = await getServerUser()
    if (!user) {
        return { taxaPeriodo: 0, comissaoPeriodo: 0, comissaoAnual: 0 }
    }

    // Busca o vendedor master FANTINI com vigências
    const vendedorFantini = await prisma.vendedor.findFirst({
        where: {
            nome: { contains: 'FANTINI', mode: 'insensitive' }
        },
        select: {
            percentualComissao: true,
            comissaoVigencias: {
                orderBy: { dataInicio: 'desc' },
                select: { dataInicio: true, percentual: true },
            },
        }
    })

    if (!vendedorFantini) {
        return { taxaPeriodo: 0, comissaoPeriodo: 0, comissaoAnual: 0 }
    }

    const percentualPadrao = Number(vendedorFantini.percentualComissao) || 0

    // Taxa vigente no período selecionado (usa o 1º dia do mês como referência)
    const dataReferencia = (month !== null && month !== undefined)
        ? new Date(Date.UTC(year, month, 1))
        : new Date() // se não tem mês, usa hoje
    const taxaPeriodo = getPercentualNaData(
        vendedorFantini.comissaoVigencias,
        dataReferencia,
        percentualPadrao
    )

    // ── Bonificações do ANO inteiro ──
    const startYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
    const endYear = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))

    const bonificacoesAnuais = await prisma.pedido.findMany({
        where: {
            tipo: 'Bonificacao',
            data: { gte: startYear, lt: endYear },
        },
        select: {
            data: true,
            valorTotal: true,
        }
    })

    // Comissão anual ponderada (cada pedido usa a taxa vigente na sua data)
    let comissaoAnual = 0
    for (const bonif of bonificacoesAnuais) {
        const valor = Number(bonif.valorTotal) || 0
        const taxa = getPercentualNaData(
            vendedorFantini.comissaoVigencias,
            bonif.data,
            percentualPadrao
        )
        comissaoAnual += valor * (taxa / 100)
    }

    // ── Comissão do PERÍODO selecionado ──
    let comissaoPeriodo = 0
    if (month !== null && month !== undefined) {
        const startMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0))
        const endMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0))

        const bonificacoesPeriodo = bonificacoesAnuais.filter(b => {
            const t = b.data.getTime()
            return t >= startMonth.getTime() && t < endMonth.getTime()
        })

        for (const bonif of bonificacoesPeriodo) {
            const valor = Number(bonif.valorTotal) || 0
            const taxa = getPercentualNaData(
                vendedorFantini.comissaoVigencias,
                bonif.data,
                percentualPadrao
            )
            comissaoPeriodo += valor * (taxa / 100)
        }
    } else {
        comissaoPeriodo = comissaoAnual
    }

    return {
        taxaPeriodo,
        comissaoPeriodo,
        comissaoAnual,
    }
}
