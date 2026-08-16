'use client'

import React, { useState } from 'react'
import {
  AlignmentType, Document, Header, ImageRun, Packer, Paragraph, TextRun,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
} from 'docx'
import toast from 'react-hot-toast'

interface F {
  razaoSocial: string; enderecoSede: string
  socioNome: string; socioGenero: 'masculino' | 'feminino'
  socioNacionalidade: string; socioNaturalidade: string
  socioEstadoCivil: string; socioRegimeBens: string
  socioProfissao: string; socioRG: string; socioCPF: string; socioEnderecoRes: string
  capitalValor: string; capitalExtenso: string
  quotasNumero: string; quotasExtenso: string
  quotasValorUnit: string; quotasValorUnitExtenso: string
  objetoSocial: string; enquadramento: 'ME' | 'EPP'
  foro: string; localAssinatura: string; dataAssinatura: string
  comTimbrado: boolean
}

const VAZIO: F = {
  razaoSocial: '', enderecoSede: '',
  socioNome: '', socioGenero: 'masculino',
  socioNacionalidade: 'brasileiro', socioNaturalidade: '',
  socioEstadoCivil: 'solteiro', socioRegimeBens: '',
  socioProfissao: '', socioRG: '', socioCPF: '', socioEnderecoRes: '',
  capitalValor: '', capitalExtenso: '',
  quotasNumero: '', quotasExtenso: '',
  quotasValorUnit: '', quotasValorUnitExtenso: '',
  objetoSocial: '', enquadramento: 'ME',
  foro: '', localAssinatura: '', dataAssinatura: '',
  comTimbrado: true,
}

function fmtData(iso: string) {
  if (!iso) return '[data]'
  const [y, m, d] = iso.split('-')
  const ms = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${parseInt(d)} de ${ms[parseInt(m)-1]} de ${y}`
}

function vars(f: F) {
  const m = f.socioGenero === 'masculino'
  return {
    abaixo: m ? 'o abaixo assinado' : 'a abaixo assinada',
    unico: m ? 'O único sócio' : 'A única sócia',
    unicoMin: m ? 'o único sócio' : 'a única sócia',
    ao: m ? 'ao único sócio' : 'à única sócia',
    do: m ? 'do único sócio' : 'da única sócia',
    trat: m ? 'o Sr.' : 'a Sra.',
    res: m ? 'residente e domiciliado' : 'residente e domiciliada',
    port: m ? 'portador' : 'portadora',
  }
}

function gerarHTML(f: F): string {
  const v = vars(f)
  const regime = f.socioRegimeBens ? `, ${f.socioRegimeBens}` : ''
  const rs = f.razaoSocial || '[RAZÃO SOCIAL]'
  const sede = f.enderecoSede || '[endereço da sede]'
  const nome = f.socioNome || '[NOME DO SÓCIO]'
  const uf = f.localAssinatura.includes('/') ? f.localAssinatura.split('/').pop() : 'SP'

  const cl11 = f.enquadramento === 'ME'
    ? `<p><b>CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE MICROEMPRESA-ME:</b><br/>Declara, sob as penas da lei, que se enquadra na condição de MICROEMPRESA – ME nos termos da Lei Complementar nº 123, de 14/12/2006.</p>`
    : `<p><b>CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE EMPRESA DE PEQUENO PORTE-EPP:</b><br/>Declara, sob as penas da lei, que se enquadra na condição de EMPRESA DE PEQUENO PORTE – EPP nos termos da Lei Complementar nº 123, de 14/12/2006.</p>`

  return `<p style="text-align:center"><b>INSTRUMENTO PARTICULAR DE CONSTITUIÇÃO DE<br/>SOCIEDADE LIMITADA</b></p>
<p style="text-align:center"><b>${rs}</b></p>
<p>Por este instrumento decidiram por unanimidade e na melhor forma de direito, constituir uma Sociedade Empresária, sob a forma de Sociedade Limitada Unipessoal, em obediência aos termos dos artigos 1.052 e seguintes do Código Civil (Lei nº. 10.406 de 10/01/2002) ${v.abaixo}:</p>
<p>${nome}, ${f.socioNacionalidade || 'brasileiro(a)'}, natural de ${f.socioNaturalidade || '[naturalidade]'}, ${f.socioEstadoCivil || '[estado civil]'}${regime}, ${f.socioProfissao || '[profissão]'}, ${v.port} do RG nº. ${f.socioRG || '[RG]'}, e CPF nº. ${f.socioCPF || '[CPF]'}, ${v.res} na ${f.socioEnderecoRes || '[endereço residencial]'}.</p>
<p>O presente instrumento será regido pelas seguintes cláusulas e condições ora determinadas:</p>
<p style="text-align:center">(artigo 997, I, CC/2002)</p>
<p><b>CLÁUSULA PRIMEIRA – DA DENOMINAÇÃO E SEDE:</b><br/>A sociedade unipessoal gira sob o nome empresarial ${rs}, e tem sede e domicílio na ${sede}, podendo abrir filiais, sucursais, agências e escritórios em qualquer parte do território nacional, a critério ${v.do}.</p>
<p style="text-align:center">(artigo 997, II, CC/2002)</p>
<p><b>PARÁGRAFO ÚNICO:</b> O referido endereço é de uso exclusivo para correspondência.</p>
<p><b>CLÁUSULA SEGUNDA – DO CAPITAL SOCIAL:</b><br/>O capital social é de R$ ${f.capitalValor || '[valor]'} (${f.capitalExtenso || '[extenso]'}), divididos em ${f.quotasNumero || '[nº]'} (${f.quotasExtenso || '[extenso]'}) quotas no valor de R$ ${f.quotasValorUnit || '[unit]'} (${f.quotasValorUnitExtenso || '[extenso unit]'}) cada uma, totalmente subscrito e integralizada em moeda corrente do país, em sua totalidade ${v.ao} ${nome}.</p>
<p><b>PARÁGRAFO ÚNICO:</b> Em consonância ao artigo 1.052 da Lei 10.406/2002 a responsabilidade ${v.do} é restrita ao valor de suas quotas, não havendo responsabilidade solidária pelas obrigações sociais, respondendo, no entanto, pela integralização do capital social.</p>
<p style="text-align:center">(artigos 997, III; 1.052, 1.055, CC/2002)</p>
<p><b>CLÁUSULA TERCEIRA – DO OBJETIVO SOCIAL:</b><br/>A sociedade tem como objetivo social o ramo de: ${f.objetoSocial || '[objeto social]'}</p>
<p><b>CLÁUSULA QUARTA – DO PRAZO DE DURAÇÃO E INÍCIO DAS ATIVIDADES:</b><br/>A sociedade iniciará suas atividades a partir da assinatura do instrumento de constituição e o prazo de duração é por tempo indeterminado.</p>
<p style="text-align:center">(artigo 997, II, CC/2002)</p>
<p><b>CLÁUSULA QUINTA – DO CONSELHO FISCAL:</b><br/>Fica estabelecido que a sociedade não terá conselho fiscal.</p>
<p><b>CLÁUSULA SEXTA – DA ADMINISTRAÇÃO E GERENCIAMENTO:</b><br/>A administração da sociedade caberá ${v.ao} ${v.trat} ${nome}, assinando isoladamente, com os poderes e atribuições ilimitados autorizando o uso do nome empresarial, vedada, no entanto, em atividades estranhas ao interesse social ou assumir obrigações seja em forma de qualquer da quotista ou de terceiros, bem como onerar ou alienar bens imóveis da sociedade, obrigar a sociedade em atividades estranhas ao objeto social, tais como fiança, aval, endosso, aceite e de todo e qualquer título de favor.</p>
<p><b>PARÁGRAFO PRIMEIRO:</b> ${v.unico} poderá ter uma remuneração mensal a título de pró-labore, que será determinada mensalmente de acordo com a capacidade financeira da sociedade e os resultados apurados.</p>
<p><b>PARÁGRAFO SEGUNDO:</b> O administrador da sociedade poderá nomear procuradores para agirem em nome da sociedade, cujo instrumento de mandato estabelecerá os poderes que lhes são atribuídos.</p>
<p style="text-align:center">(artigos 997, VI; 1.013; 1.015; 1.064, CC/2002)</p>
<p><b>CLÁUSULA SÉTIMA – DOS DEVERES CONTÁBEIS:</b><br/>Ao término de cada exercício social, em 31 de dezembro, será procedido a elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo ${v.ao}, os lucros e perdas apuradas.</p>
<p><b>PARÁGRAFO ÚNICO:</b> Fica a sociedade limitada unipessoal autorizada a levantar balanços ou balancetes intermediários em qualquer período do ano calendário, observadas as disposições legais, podendo inclusive, distribuir os resultados se houver e se for de interesse ${v.do}, inclusive a obrigação da reposição dos lucros, se os mesmos forem distribuídos com prejuízo do capital.</p>
<p style="text-align:center">(artigo 1.065, CC/2002)</p>
<p><b>CLÁUSULA OITAVA – DO FALECIMENTO E INTERDIÇÃO DO ÚNICO SÓCIO:</b><br/>Falecendo ou interditado o único sócio da sociedade, a empresa continuará suas atividades com os herdeiros, sucessores. Não sendo possível ou inexistindo interesse destes, o valor de seus haveres será apurado e liquidado com base na situação patrimonial da empresa, à data da resolução, verificada em balanço especialmente levantado.</p>
<p><b>CLÁUSULA NONA – DA DISSOLUÇÃO E LIQUIDAÇÃO DA SOCIEDADE:</b><br/>A sociedade poderá ser dissolvida por iniciativa ${v.do}, que, nessa hipótese, realizará diretamente a liquidação ou indicará um liquidante, ditando-lhe a forma de liquidação. Solvidas as dívidas e extintas as obrigações da sociedade, o patrimônio remanescente será integramente incorporado ao patrimônio ${v.do}.</p>
<p><b>CLÁUSULA DÉCIMA – DOS DESIMPEDIMENTOS:</b><br/>${v.unico}, já qualificado, declara, sob as penas da lei, que não está impedido de exercer a administração da sociedade, nem por decorrência de lei especial, nem em virtude de condenação nas hipóteses mencionadas no artigo 1.011, § 1º, do Código Civil (Lei nº. 10.406 de 10/01/2002).</p>
<p style="text-align:center">(artigo 1.011, I, CC/2002)</p>
${cl11}
<p><b>CLÁUSULA DÉCIMA SEGUNDA – DE ASSINATURA ELETRÔNICA:</b><br/>As partes reconhecem a veracidade, autenticidade, integridade, validade e eficácia do presente instrumento e seus termos, nos moldes do art. 219 do Código Civil, em formato eletrônico e/ou assinado por meio de plataformas eletrônicas, bem como expressamente anuem, autorizam, aceitam e reconhecem como valida qualquer forma de comprovação de autoria das partes signatárias deste instrumento por meio de suas respectivas assinaturas por meio de quaisquer meios eletrônicos validos emitidos ou não pela ICP Brasil, nos termos do art. 10, &amp; 2°, da Medida Provisória n°2.220-2, de 24 de agosto de 2001 ("MP n° 2.220-2").</p>
<p><b>CLÁUSULA DÉCIMA TERCEIRA – DO FORO:</b><br/>Fica eleito o foro de ${f.foro || '[foro]'} para o exercício e o cumprimento dos direitos e obrigações resultantes deste contrato.</p>
<p>E, por assim estar de pleno acordo, assina o presente instrumento em 01 (uma) via, sendo arquivada digitalmente na JUNTA COMERCIAL DO ESTADO DE ${uf}.</p>
<p style="margin-top:32px">${f.localAssinatura || '[Local]'}, ${fmtData(f.dataAssinatura)}</p>
<div style="margin-top:80px;text-align:center">
  <p style="border-top:1px solid #000;display:inline-block;padding-top:4px;min-width:280px"><b>${nome}</b><br/>${nome}</p>
</div>`
}

function p(text: string, extraAlign?: typeof AlignmentType[keyof typeof AlignmentType], bold = false, center = false): Paragraph {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : (extraAlign ?? AlignmentType.JUSTIFIED),
    spacing: { after: 160 },
    children: [new TextRun({ text, font: 'Times New Roman', size: 24, bold })],
  })
}

function pMixed(runs: Array<{ text: string; bold?: boolean }>, center = false): Paragraph {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: runs.map(r => new TextRun({ text: r.text, font: 'Times New Roman', size: 24, bold: r.bold })),
  })
}

async function gerarDocx(f: F): Promise<Blob> {
  const v = vars(f)
  const regime = f.socioRegimeBens ? `, ${f.socioRegimeBens}` : ''
  const rs = f.razaoSocial || '[RAZÃO SOCIAL]'
  const sede = f.enderecoSede || '[endereço da sede]'
  const nome = f.socioNome || '[NOME DO SÓCIO]'
  const uf = f.localAssinatura.includes('/') ? f.localAssinatura.split('/').pop() : 'SP'

  const cl11Title = f.enquadramento === 'ME'
    ? 'CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE MICROEMPRESA-ME:'
    : 'CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE EMPRESA DE PEQUENO PORTE-EPP:'
  const cl11Body = f.enquadramento === 'ME'
    ? 'Declara, sob as penas da lei, que se enquadra na condição de MICROEMPRESA – ME nos termos da Lei Complementar nº 123, de 14/12/2006.'
    : 'Declara, sob as penas da lei, que se enquadra na condição de EMPRESA DE PEQUENO PORTE – EPP nos termos da Lei Complementar nº 123, de 14/12/2006.'

  const children: Paragraph[] = [
    p('INSTRUMENTO PARTICULAR DE CONSTITUIÇÃO DE', undefined, true, true),
    p('SOCIEDADE LIMITADA', undefined, true, true),
    p(rs, undefined, true, true),
    p(''),
    p(`Por este instrumento decidiram por unanimidade e na melhor forma de direito, constituir uma Sociedade Empresária, sob a forma de Sociedade Limitada Unipessoal, em obediência aos termos dos artigos 1.052 e seguintes do Código Civil (Lei nº. 10.406 de 10/01/2002) ${v.abaixo}:`),
    p(`${nome}, ${f.socioNacionalidade || 'brasileiro(a)'}, natural de ${f.socioNaturalidade || '[naturalidade]'}, ${f.socioEstadoCivil || '[estado civil]'}${regime}, ${f.socioProfissao || '[profissão]'}, ${v.port} do RG nº. ${f.socioRG || '[RG]'}, e CPF nº. ${f.socioCPF || '[CPF]'}, ${v.res} na ${f.socioEnderecoRes || '[endereço residencial]'}.`),
    p('O presente instrumento será regido pelas seguintes cláusulas e condições ora determinadas:'),
    p('(artigo 997, I, CC/2002)', undefined, false, true),
    pMixed([{ text: 'CLÁUSULA PRIMEIRA – DA DENOMINAÇÃO E SEDE: ', bold: true }, { text: `A sociedade unipessoal gira sob o nome empresarial ${rs}, e tem sede e domicílio na ${sede}, podendo abrir filiais, sucursais, agências e escritórios em qualquer parte do território nacional, a critério ${v.do}.` }]),
    p('(artigo 997, II, CC/2002)', undefined, false, true),
    pMixed([{ text: 'PARÁGRAFO ÚNICO: ', bold: true }, { text: 'O referido endereço é de uso exclusivo para correspondência.' }]),
    pMixed([{ text: 'CLÁUSULA SEGUNDA – DO CAPITAL SOCIAL: ', bold: true }, { text: `O capital social é de R$ ${f.capitalValor || '[valor]'} (${f.capitalExtenso || '[extenso]'}), divididos em ${f.quotasNumero || '[nº]'} (${f.quotasExtenso || '[extenso]'}) quotas no valor de R$ ${f.quotasValorUnit || '[unit]'} (${f.quotasValorUnitExtenso || '[extenso unit]'}) cada uma, totalmente subscrito e integralizada em moeda corrente do país, em sua totalidade ${v.ao} ${nome}.` }]),
    pMixed([{ text: 'PARÁGRAFO ÚNICO: ', bold: true }, { text: `Em consonância ao artigo 1.052 da Lei 10.406/2002 a responsabilidade ${v.do} é restrita ao valor de suas quotas, não havendo responsabilidade solidária pelas obrigações sociais, respondendo, no entanto, pela integralização do capital social.` }]),
    p('(artigos 997, III; 1.052, 1.055, CC/2002)', undefined, false, true),
    pMixed([{ text: 'CLÁUSULA TERCEIRA – DO OBJETIVO SOCIAL: ', bold: true }, { text: `A sociedade tem como objetivo social o ramo de: ${f.objetoSocial || '[objeto social]'}` }]),
    pMixed([{ text: 'CLÁUSULA QUARTA – DO PRAZO DE DURAÇÃO E INÍCIO DAS ATIVIDADES: ', bold: true }, { text: 'A sociedade iniciará suas atividades a partir da assinatura do instrumento de constituição e o prazo de duração é por tempo indeterminado.' }]),
    p('(artigo 997, II, CC/2002)', undefined, false, true),
    pMixed([{ text: 'CLÁUSULA QUINTA – DO CONSELHO FISCAL: ', bold: true }, { text: 'Fica estabelecido que a sociedade não terá conselho fiscal.' }]),
    pMixed([{ text: 'CLÁUSULA SEXTA – DA ADMINISTRAÇÃO E GERENCIAMENTO: ', bold: true }, { text: `A administração da sociedade caberá ${v.ao} ${v.trat} ${nome}, assinando isoladamente, com os poderes e atribuições ilimitados autorizando o uso do nome empresarial, vedada, no entanto, em atividades estranhas ao interesse social ou assumir obrigações seja em forma de qualquer da quotista ou de terceiros, bem como onerar ou alienar bens imóveis da sociedade, obrigar a sociedade em atividades estranhas ao objeto social, tais como fiança, aval, endosso, aceite e de todo e qualquer título de favor.` }]),
    pMixed([{ text: 'PARÁGRAFO PRIMEIRO: ', bold: true }, { text: `${v.unico} poderá ter uma remuneração mensal a título de pró-labore, que será determinada mensalmente de acordo com a capacidade financeira da sociedade e os resultados apurados.` }]),
    pMixed([{ text: 'PARÁGRAFO SEGUNDO: ', bold: true }, { text: 'O administrador da sociedade poderá nomear procuradores para agirem em nome da sociedade, cujo instrumento de mandato estabelecerá os poderes que lhes são atribuídos.' }]),
    p('(artigos 997, VI; 1.013; 1.015; 1.064, CC/2002)', undefined, false, true),
    pMixed([{ text: 'CLÁUSULA SÉTIMA – DOS DEVERES CONTÁBEIS: ', bold: true }, { text: `Ao término de cada exercício social, em 31 de dezembro, será procedido a elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo ${v.ao}, os lucros e perdas apuradas.` }]),
    pMixed([{ text: 'PARÁGRAFO ÚNICO: ', bold: true }, { text: `Fica a sociedade limitada unipessoal autorizada a levantar balanços ou balancetes intermediários em qualquer período do ano calendário, observadas as disposições legais, podendo inclusive, distribuir os resultados se houver e se for de interesse ${v.do}, inclusive a obrigação da reposição dos lucros, se os mesmos forem distribuídos com prejuízo do capital.` }]),
    p('(artigo 1.065, CC/2002)', undefined, false, true),
    pMixed([{ text: 'CLÁUSULA OITAVA – DO FALECIMENTO E INTERDIÇÃO DO ÚNICO SÓCIO: ', bold: true }, { text: 'Falecendo ou interditado o único sócio da sociedade, a empresa continuará suas atividades com os herdeiros, sucessores. Não sendo possível ou inexistindo interesse destes, o valor de seus haveres será apurado e liquidado com base na situação patrimonial da empresa, à data da resolução, verificada em balanço especialmente levantado.' }]),
    pMixed([{ text: 'CLÁUSULA NONA – DA DISSOLUÇÃO E LIQUIDAÇÃO DA SOCIEDADE: ', bold: true }, { text: `A sociedade poderá ser dissolvida por iniciativa ${v.do}, que, nessa hipótese, realizará diretamente a liquidação ou indicará um liquidante, ditando-lhe a forma de liquidação. Solvidas as dívidas e extintas as obrigações da sociedade, o patrimônio remanescente será integramente incorporado ao patrimônio ${v.do}.` }]),
    pMixed([{ text: 'CLÁUSULA DÉCIMA – DOS DESIMPEDIMENTOS: ', bold: true }, { text: `${v.unico}, já qualificado, declara, sob as penas da lei, que não está impedido de exercer a administração da sociedade, nem por decorrência de lei especial, nem em virtude de condenação nas hipóteses mencionadas no artigo 1.011, § 1º, do Código Civil (Lei nº. 10.406 de 10/01/2002).` }]),
    p('(artigo 1.011, I, CC/2002)', undefined, false, true),
    pMixed([{ text: cl11Title + ' ', bold: true }, { text: cl11Body }]),
    pMixed([{ text: 'CLÁUSULA DÉCIMA SEGUNDA – DE ASSINATURA ELETRÔNICA: ', bold: true }, { text: 'As partes reconhecem a veracidade, autenticidade, integridade, validade e eficácia do presente instrumento e seus termos, nos moldes do art. 219 do Código Civil, em formato eletrônico e/ou assinado por meio de plataformas eletrônicas, bem como expressamente anuem, autorizam, aceitam e reconhecem como valida qualquer forma de comprovação de autoria das partes signatárias deste instrumento por meio de suas respectivas assinaturas por meio de quaisquer meios eletrônicos validos emitidos ou não pela ICP Brasil, nos termos do art. 10, & 2°, da Medida Provisória n°2.220-2, de 24 de agosto de 2001 ("MP n° 2.220-2").' }]),
    pMixed([{ text: 'CLÁUSULA DÉCIMA TERCEIRA – DO FORO: ', bold: true }, { text: `Fica eleito o foro de ${f.foro || '[foro]'} para o exercício e o cumprimento dos direitos e obrigações resultantes deste contrato.` }]),
    p(`E, por assim estar de pleno acordo, assina o presente instrumento em 01 (uma) via, sendo arquivada digitalmente na JUNTA COMERCIAL DO ESTADO DE ${uf}.`),
    p(''),
    p(`${f.localAssinatura || '[Local]'}, ${fmtData(f.dataAssinatura)}`),
    p(''),
    p(''),
    p(''),
    p(nome, undefined, true, true),
    p(nome, undefined, false, true),
  ]

  let headerSection = {}
  if (f.comTimbrado) {
    try {
      const resp = await fetch('/timbrado-unipessoal.jpeg')
      const buf = await resp.arrayBuffer()
      headerSection = {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: buf,
                    type: 'jpg',
                    transformation: { width: 794, height: 1123 },
                    floating: {
                      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                      behindDocument: true,
                      allowOverlap: true,
                    },
                  } as any),
                ],
              }),
            ],
          }),
        },
      }
    } catch {
      toast.error('Timbrado não encontrado — gerando sem')
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1701, bottom: 1134, left: 1701, right: 1134 },
        },
      },
      ...headerSection,
      children,
    }],
  })

  return Packer.toBlob(doc)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const sel = inp + ' bg-white'
const ta = inp + ' resize-none'

export default function UnipessoalWizard() {
  const [f, setF] = useState<F>(VAZIO)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [exporting, setExporting] = useState(false)

  const set = (key: keyof F, val: string | boolean) => setF(prev => ({ ...prev, [key]: val }))

  const precisaRegime = ['casado', 'casada', 'em união estável'].includes(f.socioEstadoCivil)

  async function exportarDocx() {
    setExporting(true)
    try {
      const blob = await gerarDocx(f)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato Social - ${f.razaoSocial || 'Unipessoal'}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Contrato Word gerado!')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao gerar DOCX')
    }
    setExporting(false)
  }

  function imprimirPDF() {
    const html = gerarHTML(f)
    const origin = window.location.origin
    const timbradoCSS = f.comTimbrado
      ? `@media print { body::before { content:''; position:fixed; top:0; left:0; width:100%; height:100%; background:url('${origin}/timbrado-unipessoal.jpeg') no-repeat center/100% 100%; z-index:-1; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }`
      : ''
    const win = window.open('', '_blank')
    if (!win) { toast.error('Popup bloqueado — permita popups nesta página'); return }
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Contrato Social - ${f.razaoSocial || 'Unipessoal'}</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin: 3cm 2cm 2cm 3cm; line-height: 1.5; color: #000; }
        p { text-align: justify; margin: 0 0 10pt 0; }
        @media print { @page { size: A4; margin: 3cm 2cm 2cm 3cm; } }
        ${timbradoCSS}
      </style>
    </head><body>${html}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div>
      {/* Header + toggle timbrado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Contrato Social – Unipessoal</h2>
          <p className="text-xs text-gray-500 mt-0.5">Preencha os dados e exporte em Word ou PDF</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm font-medium text-gray-700">Com Timbrado</span>
          <div
            onClick={() => set('comTimbrado', !f.comTimbrado)}
            className={`relative w-10 h-6 rounded-full transition-colors ${f.comTimbrado ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${f.comTimbrado ? 'left-5' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(['1. Dados', '2. Capital & Config', '3. Prévia & Exportar'] as const).map((label, i) => (
          <button key={i} onClick={() => setStep((i + 1) as 1 | 2 | 3)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              step === i + 1 ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PASSO 1 ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Empresa */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Dados da Empresa</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Razão Social *">
                <input className={inp} value={f.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} placeholder="EMPRESA EXEMPLO LTDA" />
              </Field>
              <Field label="Endereço da Sede (completo) *">
                <input className={inp} value={f.enderecoSede} onChange={e => set('enderecoSede', e.target.value)}
                  placeholder="Rua Israel, 90 - Rochdale - Osasco/SP - CEP: 06220-053" />
              </Field>
            </div>
          </div>

          {/* Sócio */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Dados do Sócio Único</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome Completo *">
                <input className={inp} value={f.socioNome} onChange={e => set('socioNome', e.target.value)} placeholder="NOME DO SÓCIO" />
              </Field>
              <Field label="Gênero">
                <select className={sel} value={f.socioGenero} onChange={e => set('socioGenero', e.target.value)}>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </Field>
              <Field label="Nacionalidade">
                <input className={inp} value={f.socioNacionalidade} onChange={e => set('socioNacionalidade', e.target.value)} placeholder="brasileiro / brasileira" />
              </Field>
              <Field label="Naturalidade (cidade/UF)">
                <input className={inp} value={f.socioNaturalidade} onChange={e => set('socioNaturalidade', e.target.value)} placeholder="São Paulo/SP" />
              </Field>
              <Field label="Estado Civil">
                <select className={sel} value={f.socioEstadoCivil} onChange={e => set('socioEstadoCivil', e.target.value)}>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viúvo">Viúvo(a)</option>
                  <option value="separado judicialmente">Separado(a) Judicialmente</option>
                  <option value="em união estável">Em União Estável</option>
                </select>
              </Field>
              {precisaRegime && (
                <Field label="Regime de Bens">
                  <select className={sel} value={f.socioRegimeBens} onChange={e => set('socioRegimeBens', e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="regime de comunhão parcial de bens">Comunhão Parcial de Bens</option>
                    <option value="regime de comunhão universal de bens">Comunhão Universal de Bens</option>
                    <option value="regime de separação total de bens">Separação Total de Bens</option>
                    <option value="regime de participação final nos aquestos">Participação Final nos Aquestos</option>
                  </select>
                </Field>
              )}
              <Field label="Profissão">
                <input className={inp} value={f.socioProfissao} onChange={e => set('socioProfissao', e.target.value)} placeholder="empresário" />
              </Field>
              <Field label="RG nº">
                <input className={inp} value={f.socioRG} onChange={e => set('socioRG', e.target.value)} placeholder="00.000.000-0" />
              </Field>
              <Field label="CPF nº">
                <input className={inp} value={f.socioCPF} onChange={e => set('socioCPF', e.target.value)} placeholder="000.000.000-00" />
              </Field>
              <Field label="Endereço Residencial (completo)">
                <input className={inp} value={f.socioEnderecoRes} onChange={e => set('socioEnderecoRes', e.target.value)}
                  placeholder="Rua Exemplo, 100 - Bairro - Cidade/UF - CEP: 00000-000" />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-primary px-6 py-2 text-sm">
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ── PASSO 2 ── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Capital */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Capital Social & Quotas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Valor do Capital (R$)">
                <input className={inp} value={f.capitalValor} onChange={e => set('capitalValor', e.target.value)} placeholder="15.000,00" />
              </Field>
              <Field label="Capital por Extenso">
                <input className={inp} value={f.capitalExtenso} onChange={e => set('capitalExtenso', e.target.value)} placeholder="Quinze mil reais" />
              </Field>
              <Field label="Número de Quotas">
                <input className={inp} value={f.quotasNumero} onChange={e => set('quotasNumero', e.target.value)} placeholder="15.000" />
              </Field>
              <Field label="Quotas por Extenso">
                <input className={inp} value={f.quotasExtenso} onChange={e => set('quotasExtenso', e.target.value)} placeholder="Quinze mil" />
              </Field>
              <Field label="Valor Unitário da Quota (R$)">
                <input className={inp} value={f.quotasValorUnit} onChange={e => set('quotasValorUnit', e.target.value)} placeholder="1,00" />
              </Field>
              <Field label="Valor Unitário por Extenso">
                <input className={inp} value={f.quotasValorUnitExtenso} onChange={e => set('quotasValorUnitExtenso', e.target.value)} placeholder="Um real" />
              </Field>
            </div>
          </div>

          {/* Objeto */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Objeto Social</h3>
            <textarea className={ta} rows={4} value={f.objetoSocial}
              onChange={e => set('objetoSocial', e.target.value)}
              placeholder="Serviços combinados de escritório e apoio administrativo;" />
          </div>

          {/* Configurações */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Configurações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Enquadramento">
                <select className={sel} value={f.enquadramento} onChange={e => set('enquadramento', e.target.value)}>
                  <option value="ME">ME – Microempresa</option>
                  <option value="EPP">EPP – Empresa de Pequeno Porte</option>
                </select>
              </Field>
              <Field label="Foro (cidade/UF)">
                <input className={inp} value={f.foro} onChange={e => set('foro', e.target.value)} placeholder="Osasco/SP" />
              </Field>
              <Field label="Local de Assinatura">
                <input className={inp} value={f.localAssinatura} onChange={e => set('localAssinatura', e.target.value)} placeholder="Osasco/SP" />
              </Field>
              <Field label="Data de Assinatura">
                <input className={inp} type="date" value={f.dataAssinatura} onChange={e => set('dataAssinatura', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              ← Voltar
            </button>
            <button onClick={() => setStep(3)} className="btn-primary px-6 py-2 text-sm">
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ── PASSO 3 ── */}
      {step === 3 && (
        <div>
          {/* Export buttons */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              ← Voltar
            </button>
            <button onClick={exportarDocx} disabled={exporting}
              className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60">
              {exporting ? <span className="animate-spin">⟳</span> : null}
              Baixar Word (.docx)
            </button>
            <button onClick={imprimirPDF}
              className="px-5 py-2 text-sm border-2 border-primary-600 text-primary-600 rounded hover:bg-primary-50 font-medium">
              Imprimir / Gerar PDF
            </button>
            <span className="text-xs text-gray-400 ml-2">
              {f.comTimbrado ? '✓ Com timbrado' : '○ Sem timbrado'}
            </span>
          </div>

          {/* Preview */}
          <div className="border rounded-lg bg-white shadow-sm overflow-auto"
            style={{ maxHeight: '70vh', padding: '3cm 2cm 2cm 3cm', fontFamily: "'Times New Roman', Times, serif", fontSize: '11pt', lineHeight: '1.5' }}>
            <div dangerouslySetInnerHTML={{ __html: gerarHTML(f) }} />
          </div>
        </div>
      )}
    </div>
  )
}
