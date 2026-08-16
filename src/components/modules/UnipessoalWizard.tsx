'use client'

import React, { useState } from 'react'
import {
  AlignmentType, Document, Header, ImageRun, Packer, Paragraph, TextRun,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
} from 'docx'
import toast from 'react-hot-toast'

// ── Number → Portuguese words ────────────────────────────────────────────────
const UNID  = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove',
  'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove']
const UNID_F= ['','uma','duas','três','quatro','cinco','seis','sete','oito','nove',
  'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove']
const DEZ   = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
const CENT  = ['','cento','duzentos','trezentos','quatrocentos','quinhentos',
  'seiscentos','setecentos','oitocentos','novecentos']
const CENT_F= ['','cento','duzentas','trezentas','quatrocentas','quinhentas',
  'seiscentas','setecentas','oitocentas','novecentas']

function g3(x: number, fem = false): string {
  if (x === 0) return ''
  if (x === 100) return 'cem'
  const c = Math.floor(x/100), r = x%100, d = Math.floor(r/10), u = r%10
  const U = fem ? UNID_F : UNID
  const C = fem ? CENT_F : CENT
  const p: string[] = []
  if (c) p.push(c === 1 && r ? 'cento' : C[c])
  if (r >= 20) { p.push(DEZ[d]); if (u) p.push(U[u]) }
  else if (r) p.push(U[r])
  return p.join(' e ')
}

function n2ext(n: number, moeda = true, fem = false): string {
  if (!n || n <= 0) return ''
  const M = Math.floor(n/1_000_000)
  const K = Math.floor((n%1_000_000)/1_000)
  const R = n%1_000
  const mPart  = M ? g3(M, fem)+(M===1?' milhão':' milhões') : ''
  const kRaw   = K ? g3(K, fem) : ''
  const kPart  = K ? ((kRaw==='um'||kRaw==='uma')?'mil':kRaw+' mil') : ''
  const rPart  = R ? g3(R, fem) : ''
  // comma between thousands and remainder (e.g. "dez mil, duzentas e trinta e nove")
  const milRest = kPart && rPart ? `${kPart}, ${rPart}` : kPart || rPart
  const parts: string[] = []
  if (mPart) parts.push(mPart)
  if (milRest) parts.push(milRest)
  const txt = parts.join(' e ')
  const cap = txt.charAt(0).toUpperCase()+txt.slice(1)
  if (!moeda) return cap
  if (M && !K && !R) return cap+(M===1?' de real':' de reais')
  return cap+(n===1?' real':' reais')
}

function parseBR(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g,'').replace(',','.'))) || 0
}

function fmtBR(n: number): string {
  return n.toLocaleString('pt-BR')
}

// ── Form data ────────────────────────────────────────────────────────────────
interface F {
  razaoSocial: string; enderecoSede: string
  socioNome: string; socioGenero: 'masculino'|'feminino'
  socioNacionalidade: string; socioNaturalidade: string
  socioEstadoCivil: string; socioRegimeBens: string
  socioProfissao: string; socioRG: string; socioCPF: string
  socioEnderecoRes: string; enderecoIgual: boolean
  capitalValor: string; capitalExtenso: string
  quotasNumero: string; quotasExtenso: string
  objetoSocial: string; enquadramento: 'ME'|'EPP'
  foro: string; localAssinatura: string; dataAssinatura: string
  comTimbrado: boolean
}

const VAZIO: F = {
  razaoSocial:'', enderecoSede:'',
  socioNome:'', socioGenero:'masculino',
  socioNacionalidade:'brasileiro', socioNaturalidade:'',
  socioEstadoCivil:'solteiro', socioRegimeBens:'',
  socioProfissao:'', socioRG:'', socioCPF:'',
  socioEnderecoRes:'', enderecoIgual: false,
  capitalValor:'', capitalExtenso:'',
  quotasNumero:'', quotasExtenso:'',
  objetoSocial:'', enquadramento:'ME',
  foro:'', localAssinatura:'', dataAssinatura:'',
  comTimbrado: true,
}

function fmtData(iso: string) {
  if (!iso) return '[data]'
  const [y,m,d] = iso.split('-')
  const ms = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${parseInt(d)} de ${ms[parseInt(m)-1]} de ${y}`
}

function v(f: F) {
  const m = f.socioGenero === 'masculino'
  return {
    abaixo:       m?'o abaixo assinado':'a abaixo assinada',
    Unico:        m?'O único sócio':'A única sócia',
    unico:        m?'o único sócio':'a única sócia',
    do:           m?'do único sócio':'da única sócia',
    pelo:         m?'pelo único sócio':'pela única sócia',
    trat:         m?'o Sr.':'a Sra.',
    res:          m?'residente e domiciliado':'residente e domiciliada',
    port:         m?'portador':'portadora',
    qualificado:  m?'qualificado':'qualificada',
    administrador:m?'O administrador':'A administradora',
    falecendo:    m?'Falecendo ou interditado o único sócio':'Falecendo ou interditada a única sócia',
    cl8titulo:    m?'CLÁUSULA OITAVA – DO FALECIMENTO E INTERDIÇÃO DO ÚNICO SÓCIO:':'CLÁUSULA OITAVA – DO FALECIMENTO E INTERDIÇÃO DA ÚNICA SÓCIA:',
  }
}

function endRes(f: F) {
  return f.enderecoIgual ? f.enderecoSede : f.socioEnderecoRes
}

const UF_NOMES: Record<string,string> = {
  AC:'ACRE',AL:'ALAGOAS',AM:'AMAZONAS',AP:'AMAPÁ',BA:'BAHIA',CE:'CEARÁ',
  DF:'DISTRITO FEDERAL',ES:'ESPÍRITO SANTO',GO:'GOIÁS',MA:'MARANHÃO',
  MG:'MINAS GERAIS',MS:'MATO GROSSO DO SUL',MT:'MATO GROSSO',PA:'PARÁ',
  PB:'PARAÍBA',PE:'PERNAMBUCO',PI:'PIAUÍ',PR:'PARANÁ',RJ:'RIO DE JANEIRO',
  RN:'RIO GRANDE DO NORTE',RO:'RONDÔNIA',RR:'RORAIMA',RS:'RIO GRANDE DO SUL',
  SC:'SANTA CATARINA',SE:'SERGIPE',SP:'SÃO PAULO',TO:'TOCANTINS',
}

// ── HTML para preview + print ─────────────────────────────────────────────────
function gerarHTML(f: F): string {
  const g = v(f)
  const regime = f.socioRegimeBens ? `, ${f.socioRegimeBens}` : ''
  const rs = f.razaoSocial || '[RAZÃO SOCIAL]'
  const sede = f.enderecoSede || '[endereço da sede]'
  const nome = f.socioNome || '[NOME DO SÓCIO]'
  const nac = f.socioNacionalidade || 'brasileiro(a)'
  const nat = f.socioNaturalidade || '[naturalidade]'
  const ec = f.socioEstadoCivil || '[estado civil]'
  const prof = f.socioProfissao || '[profissão]'
  const rg = f.socioRG || '[RG]'
  const cpf = f.socioCPF || '[CPF]'
  const er = endRes(f) || '[endereço residencial]'
  const cv = f.capitalValor || '[valor]'
  const ce = f.capitalExtenso || '[extenso]'
  const qn = f.quotasNumero || '[nº]'
  const qe = f.quotasExtenso || '[extenso]'
  const ob = f.objetoSocial || '[objeto social]'
  const fo = f.foro || '[foro]'
  const lo = f.localAssinatura || '[Local]'
  const dt = fmtData(f.dataAssinatura)
  const uf = lo.includes('/') ? lo.split('/').pop()! : 'SP'
  const estadoNome = UF_NOMES[uf] || uf

  const cl11t = f.enquadramento === 'ME'
    ? 'CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE MICROEMPRESA-ME:'
    : 'CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE EMPRESA DE PEQUENO PORTE-EPP:'
  const cl11b = f.enquadramento === 'ME'
    ? 'Declara, sob as penas da lei, que se enquadra na condição de MICROEMPRESA – ME nos termos da Lei Complementar nº 123, de 14/12/2006.'
    : 'Declara, sob as penas da lei, que se enquadra na condição de EMPRESA DE PEQUENO PORTE – EPP nos termos da Lei Complementar nº 123, de 14/12/2006.'

  const obLines = (f.objetoSocial || '[objeto social]').split('\n').filter(l => l.trim())

  const S = `font-family:'Times New Roman',Times,serif;font-size:12pt;text-align:justify;margin:0 0 8pt 0;line-height:1.5`
  const C = `font-family:'Times New Roman',Times,serif;font-size:12pt;text-align:center;margin:0 0 8pt 0;line-height:1.5`

  return `
<p style="${C}"><b>INSTRUMENTO PARTICULAR DE CONSTITUIÇÃO DE</b></p>
<p style="${C}"><b>SOCIEDADE LIMITADA</b></p>
<p style="${C}"><b>${rs}</b></p>
<p style="${S}">&nbsp;</p>
<p style="${S}">Por este instrumento decidiram por unanimidade e na melhor forma de direito, constituir uma Sociedade Empresária, sob a forma de Sociedade Limitada Unipessoal, em obediência aos termos dos artigos 1.052 e seguintes do Código Civil (Lei nº. 10.406 de 10/01/2002) ${g.abaixo}:</p>
<p style="${S}"><b>${nome}</b>, ${nac}, natural de ${nat}, ${ec}${regime}, ${prof}, ${g.port} do RG nº. ${rg}, e CPF nº. ${cpf}, ${g.res} na ${er}.</p>
<p style="${S}">O presente instrumento será regido pelas seguintes cláusulas e condições ora determinadas:</p>
<p style="${C}">(artigo 997, I, CC/2002)</p>
<p style="${S}"><b>CLÁUSULA PRIMEIRA – DA DENOMINAÇÃO E SEDE:</b></p>
<p style="${S}">A sociedade unipessoal gira sob o nome empresarial <b>${rs}</b>, e tem sede e domicílio na ${sede}, podendo abrir filiais, sucursais, agências e escritórios em qualquer parte do território nacional, a critério ${g.do}.</p>
<p style="${C}">(artigo 997, II, CC/2002)</p>
<p style="${S}"><b>PARÁGRAFO ÚNICO:</b> O referido endereço é de uso exclusivo para correspondência.</p>
<p style="${S}"><b>CLÁUSULA SEGUNDA – DO CAPITAL SOCIAL:</b></p>
<p style="${S}">O capital social é de R$ ${cv} (${ce}), divididos em ${qn} (${qe}) quotas no valor de R$ 1,00 (Um real) cada uma, totalmente subscrito e integralizada em moeda corrente do país, em sua totalidade ${g.pelo} <b>${nome}</b>.</p>
<p style="${S}"><b>PARÁGRAFO ÚNICO:</b> Em consonância ao artigo 1.052 da Lei 10.406/2002 a responsabilidade ${g.do} é restrita ao valor de suas quotas, não havendo responsabilidade solidária pelas obrigações sociais, respondendo, no entanto, pela integralização do capital social.</p>
<p style="${C}">(artigos 997, III; 1.052, 1.055, CC/2002)</p>
<p style="${S}"><b>CLÁUSULA TERCEIRA – DO OBJETIVO SOCIAL:</b></p>
<p style="${S}">A sociedade tem como objetivo social o ramo de:</p>
${obLines.map(l => `<p style="${S}"><b>• ${l.trim()}</b></p>`).join('')}
<p style="${S}"><b>CLÁUSULA QUARTA – DO PRAZO DE DURAÇÃO E INÍCIO DAS ATIVIDADES:</b></p>
<p style="${S}">A sociedade iniciará suas atividades a partir da assinatura do instrumento de constituição e o prazo de duração é por tempo indeterminado.</p>
<p style="${C}">(artigo 997, II, CC/2002)</p>
<p style="${S}"><b>CLÁUSULA QUINTA – DO CONSELHO FISCAL:</b></p>
<p style="${S}">Fica estabelecido que a sociedade não terá conselho fiscal.</p>
<p style="${S}"><b>CLÁUSULA SEXTA – DA ADMINISTRAÇÃO E GERENCIAMENTO:</b></p>
<p style="${S}">A administração da sociedade caberá ${g.unico} ${g.trat} <b>${nome}</b>, assinando isoladamente, com os poderes e atribuições ilimitados autorizando o uso do nome empresarial, vedada, no entanto, em atividades estranhas ao interesse social ou assumir obrigações seja em forma de qualquer da quotista ou de terceiros, bem como onerar ou alienar bens imóveis da sociedade, obrigar a sociedade em atividades estranhas ao objeto social, tais como fiança, aval, endosso, aceite e de todo e qualquer título de favor.</p>
<p style="${S}"><b>PARÁGRAFO PRIMEIRO:</b> ${g.Unico} poderá ter uma remuneração mensal a título de pró-labore, que será determinada mensalmente de acordo com a capacidade financeira da sociedade e os resultados apurados.</p>
<p style="${S}"><b>PARÁGRAFO SEGUNDO:</b> ${g.administrador} da sociedade poderá nomear procuradores para agirem em nome da sociedade, cujo instrumento de mandato estabelecerá os poderes que lhes são atribuídos.</p>
<p style="${C}">(artigos 997, VI; 1.013; 1.015; 1.064, CC/2002)</p>
<p style="${S}"><b>CLÁUSULA SÉTIMA – DOS DEVERES CONTÁBEIS:</b></p>
<p style="${S}">Ao término de cada exercício social, em 31 de dezembro, será procedido a elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo ${g.unico}, os lucros e perdas apuradas.</p>
<p style="${S}"><b>PARÁGRAFO ÚNICO:</b> Fica a sociedade limitada unipessoal autorizada a levantar balanços ou balancetes intermediários em qualquer período do ano calendário, observadas as disposições legais, podendo inclusive, distribuir os resultados se houver e se for de interesse ${g.do}, inclusive a obrigação da reposição dos lucros, se os mesmos forem distribuídos com prejuízo do capital.</p>
<p style="${C}">(artigo 1.065, CC/2002)</p>
<p style="${S}"><b>${g.cl8titulo}</b></p>
<p style="${S}">${g.falecendo} da sociedade, a empresa continuará suas atividades com os herdeiros, sucessores. Não sendo possível ou inexistindo interesse destes, o valor de seus haveres será apurado e liquidado com base na situação patrimonial da empresa, à data da resolução, verificada em balanço especialmente levantado.</p>
<p style="${S}"><b>CLÁUSULA NONA – DA DISSOLUÇÃO E LIQUIDAÇÃO DA SOCIEDADE:</b></p>
<p style="${S}">A sociedade poderá ser dissolvida por iniciativa ${g.do}, que, nessa hipótese, realizará diretamente a liquidação ou indicará um liquidante, ditando-lhe a forma de liquidação. Solvidas as dívidas e extintas as obrigações da sociedade, o patrimônio remanescente será integramente incorporado ao patrimônio ${g.do}.</p>
<p style="${S}"><b>CLÁUSULA DÉCIMA – DOS DESIMPEDIMENTOS:</b></p>
<p style="${S}">${g.Unico}, já ${g.qualificado}, declara, sob as penas da lei, que não está impedido de exercer a administração da sociedade, nem por decorrência de lei especial, nem em virtude de condenação nas hipóteses mencionadas no artigo 1.011, § 1º, do Código Civil (Lei nº. 10.406 de 10/01/2002).</p>
<p style="${C}">(artigo 1.011, I, CC/2002)</p>
<p style="${S}"><b>${cl11t}</b></p>
<p style="${S}"><b>${cl11b}</b></p>
<p style="${S}"><b>CLÁUSULA DÉCIMA SEGUNDA –DE ASSINATURA ELETRÔNICA:</b></p>
<p style="${S}">As partes reconhecem a veracidade, autenticidade, integridade, validade e eficácia do presente instrumento e seus termos, nos moldes do art. 219 do Código Civil, em formato eletrônico e/ou assinado por meio de plataformas eletrônicas, bem como expressamente anuem, autorizam, aceitam e reconhecem como valida qualquer forma de comprovação de autoria das partes signatárias deste instrumento por meio de suas respectivas assinaturas por meio de quaisquer meios eletrônicos validos emitidos ou não pela ICP Brasil, nos termos do art. 10, &amp; 2°, da Medida Provisória n°2.220-2, de 24 de agosto de 2001 ("MP n° 2.220-2").</p>
<p style="${S}"><b>CLÁUSULA DÉCIMA TERCEIRA – DO FORO:</b></p>
<p style="${S}">Fica eleito o foro de ${fo} para o exercício e o cumprimento dos direitos e obrigações resultantes deste contrato.</p>
<p style="${S}">E, por assim estar de pleno acordo, assina o presente instrumento em 01 (uma) via, sendo arquivada digitalmente na <b>JUNTA COMERCIAL DO ESTADO DE ${estadoNome}</b>.</p>
<p style="${S}">&nbsp;</p>
<p style="${S}">${lo}, ${dt}</p>
<p style="${S}">&nbsp;</p>
<p style="${S}">&nbsp;</p>
<p style="${C}"><b>${nome}</b></p>`
}

// ── DOCX generation ───────────────────────────────────────────────────────────
function pb(text: string, bold = false, center = false): Paragraph {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 360, lineRule: 'auto' as any },
    children: [new TextRun({ text, font: 'Times New Roman', size: 24, bold })],
  })
}

function pm(runs: Array<{text:string; bold?:boolean}>, center = false): Paragraph {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 360, lineRule: 'auto' as any },
    children: runs.map(r => new TextRun({ text: r.text, font: 'Times New Roman', size: 24, bold: r.bold })),
  })
}

function pBlank(): Paragraph {
  return new Paragraph({ spacing: { after: 120, line: 360, lineRule: 'auto' as any }, children: [new TextRun({ text: '' })] })
}

async function gerarDocx(f: F): Promise<Blob> {
  const g = v(f)
  const regime = f.socioRegimeBens ? `, ${f.socioRegimeBens}` : ''
  const rs = f.razaoSocial || '[RAZÃO SOCIAL]'
  const sede = f.enderecoSede || '[endereço da sede]'
  const nome = f.socioNome || '[NOME DO SÓCIO]'
  const er = endRes(f) || '[endereço residencial]'
  const fo = f.foro || '[foro]'
  const lo = f.localAssinatura || '[Local]'
  const dt = fmtData(f.dataAssinatura)
  const uf = lo.includes('/') ? lo.split('/').pop()! : 'SP'
  const estadoNome = UF_NOMES[uf] || uf

  const cl11t = f.enquadramento === 'ME'
    ? 'CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE MICROEMPRESA-ME:'
    : 'CLÁUSULA DÉCIMA PRIMEIRA – DA DECLARAÇÃO DE EMPRESA DE PEQUENO PORTE-EPP:'
  const cl11b = f.enquadramento === 'ME'
    ? 'Declara, sob as penas da lei, que se enquadra na condição de MICROEMPRESA – ME nos termos da Lei Complementar nº 123, de 14/12/2006.'
    : 'Declara, sob as penas da lei, que se enquadra na condição de EMPRESA DE PEQUENO PORTE – EPP nos termos da Lei Complementar nº 123, de 14/12/2006.'

  const obAtividades = (f.objetoSocial || '').split('\n').filter(l => l.trim())

  const children: Paragraph[] = [
    pb('INSTRUMENTO PARTICULAR DE CONSTITUIÇÃO DE', true, true),
    pb('SOCIEDADE LIMITADA', true, true),
    pb(rs, true, true),
    pBlank(),
    pb(`Por este instrumento decidiram por unanimidade e na melhor forma de direito, constituir uma Sociedade Empresária, sob a forma de Sociedade Limitada Unipessoal, em obediência aos termos dos artigos 1.052 e seguintes do Código Civil (Lei nº. 10.406 de 10/01/2002) ${g.abaixo}:`),
    pm([{text:nome,bold:true},{text:`, ${f.socioNacionalidade||'brasileiro(a)'}, natural de ${f.socioNaturalidade||'[naturalidade]'}, ${f.socioEstadoCivil||'[estado civil]'}${regime}, ${f.socioProfissao||'[profissão]'}, ${g.port} do RG nº. ${f.socioRG||'[RG]'}, e CPF nº. ${f.socioCPF||'[CPF]'}, ${g.res} na ${er}.`}]),
    pb('O presente instrumento será regido pelas seguintes cláusulas e condições ora determinadas:'),
    pb('(artigo 997, I, CC/2002)', false, true),
    pb('CLÁUSULA PRIMEIRA – DA DENOMINAÇÃO E SEDE:', true),
    pm([{text:'A sociedade unipessoal gira sob o nome empresarial '},{text:rs,bold:true},{text:`, e tem sede e domicílio na ${sede}, podendo abrir filiais, sucursais, agências e escritórios em qualquer parte do território nacional, a critério ${g.do}.`}]),
    pb('(artigo 997, II, CC/2002)', false, true),
    pm([{text:'PARÁGRAFO ÚNICO: ', bold:true},{text:'O referido endereço é de uso exclusivo para correspondência.'}]),
    pb('CLÁUSULA SEGUNDA – DO CAPITAL SOCIAL:', true),
    pm([{text:`O capital social é de R$ ${f.capitalValor||'[valor]'} (${f.capitalExtenso||'[extenso]'}), divididos em ${f.quotasNumero||'[nº]'} (${f.quotasExtenso||'[extenso]'}) quotas no valor de R$ 1,00 (Um real) cada uma, totalmente subscrito e integralizada em moeda corrente do país, em sua totalidade ${g.pelo} `},{text:nome,bold:true},{text:'.'}]),
    pm([{text:'PARÁGRAFO ÚNICO: ', bold:true},{text:`Em consonância ao artigo 1.052 da Lei 10.406/2002 a responsabilidade ${g.do} é restrita ao valor de suas quotas, não havendo responsabilidade solidária pelas obrigações sociais, respondendo, no entanto, pela integralização do capital social.`}]),
    pb('(artigos 997, III; 1.052, 1.055, CC/2002)', false, true),
    pb('CLÁUSULA TERCEIRA – DO OBJETIVO SOCIAL:', true),
    pb('A sociedade tem como objetivo social o ramo de:'),
    ...(obAtividades.length ? obAtividades.map(l => pb(`• ${l.trim()}`, true)) : [pb('• [objeto social]', true)]),
    pb('CLÁUSULA QUARTA – DO PRAZO DE DURAÇÃO E INÍCIO DAS ATIVIDADES:', true),
    pb('A sociedade iniciará suas atividades a partir da assinatura do instrumento de constituição e o prazo de duração é por tempo indeterminado.'),
    pb('(artigo 997, II, CC/2002)', false, true),
    pb('CLÁUSULA QUINTA – DO CONSELHO FISCAL:', true),
    pb('Fica estabelecido que a sociedade não terá conselho fiscal.'),
    pb('CLÁUSULA SEXTA – DA ADMINISTRAÇÃO E GERENCIAMENTO:', true),
    pm([{text:`A administração da sociedade caberá ${g.unico} ${g.trat} `},{text:nome,bold:true},{text:', assinando isoladamente, com os poderes e atribuições ilimitados autorizando o uso do nome empresarial, vedada, no entanto, em atividades estranhas ao interesse social ou assumir obrigações seja em forma de qualquer da quotista ou de terceiros, bem como onerar ou alienar bens imóveis da sociedade, obrigar a sociedade em atividades estranhas ao objeto social, tais como fiança, aval, endosso, aceite e de todo e qualquer título de favor.'}]),
    pm([{text:'PARÁGRAFO PRIMEIRO: ', bold:true},{text:`${g.Unico} poderá ter uma remuneração mensal a título de pró-labore, que será determinada mensalmente de acordo com a capacidade financeira da sociedade e os resultados apurados.`}]),
    pm([{text:'PARÁGRAFO SEGUNDO: ', bold:true},{text:`${g.administrador} da sociedade poderá nomear procuradores para agirem em nome da sociedade, cujo instrumento de mandato estabelecerá os poderes que lhes são atribuídos.`}]),
    pb('(artigos 997, VI; 1.013; 1.015; 1.064, CC/2002)', false, true),
    pb('CLÁUSULA SÉTIMA – DOS DEVERES CONTÁBEIS:', true),
    pb(`Ao término de cada exercício social, em 31 de dezembro, será procedido a elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo ${g.unico}, os lucros e perdas apuradas.`),
    pm([{text:'PARÁGRAFO ÚNICO: ', bold:true},{text:`Fica a sociedade limitada unipessoal autorizada a levantar balanços ou balancetes intermediários em qualquer período do ano calendário, observadas as disposições legais, podendo inclusive, distribuir os resultados se houver e se for de interesse ${g.do}, inclusive a obrigação da reposição dos lucros, se os mesmos forem distribuídos com prejuízo do capital.`}]),
    pb('(artigo 1.065, CC/2002)', false, true),
    pb(g.cl8titulo, true),
    pb(`${g.falecendo} da sociedade, a empresa continuará suas atividades com os herdeiros, sucessores. Não sendo possível ou inexistindo interesse destes, o valor de seus haveres será apurado e liquidado com base na situação patrimonial da empresa, à data da resolução, verificada em balanço especialmente levantado.`),
    pb('CLÁUSULA NONA – DA DISSOLUÇÃO E LIQUIDAÇÃO DA SOCIEDADE:', true),
    pb(`A sociedade poderá ser dissolvida por iniciativa ${g.do}, que, nessa hipótese, realizará diretamente a liquidação ou indicará um liquidante, ditando-lhe a forma de liquidação. Solvidas as dívidas e extintas as obrigações da sociedade, o patrimônio remanescente será integramente incorporado ao patrimônio ${g.do}.`),
    pb('CLÁUSULA DÉCIMA – DOS DESIMPEDIMENTOS:', true),
    pb(`${g.Unico}, já ${g.qualificado}, declara, sob as penas da lei, que não está impedido de exercer a administração da sociedade, nem por decorrência de lei especial, nem em virtude de condenação nas hipóteses mencionadas no artigo 1.011, § 1º, do Código Civil (Lei nº. 10.406 de 10/01/2002).`),
    pb('(artigo 1.011, I, CC/2002)', false, true),
    pb(cl11t, true),
    pb(cl11b, true),
    pb('CLÁUSULA DÉCIMA SEGUNDA –DE ASSINATURA ELETRÔNICA:', true),
    pb('As partes reconhecem a veracidade, autenticidade, integridade, validade e eficácia do presente instrumento e seus termos, nos moldes do art. 219 do Código Civil, em formato eletrônico e/ou assinado por meio de plataformas eletrônicas, bem como expressamente anuem, autorizam, aceitam e reconhecem como valida qualquer forma de comprovação de autoria das partes signatárias deste instrumento por meio de suas respectivas assinaturas por meio de quaisquer meios eletrônicos validos emitidos ou não pela ICP Brasil, nos termos do art. 10, & 2°, da Medida Provisória n°2.220-2, de 24 de agosto de 2001 ("MP n° 2.220-2").'),
    pb('CLÁUSULA DÉCIMA TERCEIRA – DO FORO:', true),
    pb(`Fica eleito o foro de ${fo} para o exercício e o cumprimento dos direitos e obrigações resultantes deste contrato.`),
    pm([{text:'E, por assim estar de pleno acordo, assina o presente instrumento em 01 (uma) via, sendo arquivada digitalmente na '},{text:`JUNTA COMERCIAL DO ESTADO DE ${estadoNome}`,bold:true},{text:'.'}]),
    pBlank(),
    pb(`${lo}, ${dt}`),
    pBlank(), pBlank(), pBlank(),
    pb(nome, true, true),
  ]

  let headerSection: object = {}
  if (f.comTimbrado) {
    try {
      const resp = await fetch('/timbrado-unipessoal.jpeg')
      const buf = await resp.arrayBuffer()
      headerSection = {
        headers: {
          default: new Header({
            children: [new Paragraph({
              children: [new ImageRun({
                data: buf, type: 'jpg',
                transformation: { width: 794, height: 1123 },
                floating: {
                  horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                  verticalPosition:   { relative: VerticalPositionRelativeFrom.PAGE,   offset: 0 },
                  behindDocument: true, allowOverlap: true,
                } as any,
              } as any)],
            })],
          }),
        },
      }
    } catch { toast.error('Timbrado não encontrado') }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 2805, bottom: 1418, left: 1077, right: 1134 },
        },
      },
      ...headerSection,
      children,
    }],
  })

  return Packer.toBlob(doc)
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
const inp = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const sel = inp + ' bg-white'

// ── Component ─────────────────────────────────────────────────────────────────
export default function UnipessoalWizard() {
  const [f, setF] = useState<F>(VAZIO)
  const [step, setStep] = useState<1|2|3>(1)
  const [exporting, setExporting] = useState(false)

  function set<K extends keyof F>(key: K, val: F[K]) {
    setF(prev => ({ ...prev, [key]: val }))
  }

  function handleCapital(raw: string) {
    const n = parseBR(raw)
    setF(prev => ({
      ...prev,
      capitalValor: raw,
      capitalExtenso: n > 0 ? n2ext(n, true) : prev.capitalExtenso,
      quotasNumero: n > 0 ? fmtBR(n) : prev.quotasNumero,
      quotasExtenso: n > 0 ? n2ext(n, false, true) : prev.quotasExtenso,
    }))
  }

  const precisaRegime = ['casado','casada','em união estável'].includes(f.socioEstadoCivil)

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
    const bg = f.comTimbrado
      ? `body::before{content:'';position:fixed;top:0;left:0;width:100%;height:100%;background:url('${origin}/timbrado-unipessoal.jpeg') no-repeat center/100% 100%;z-index:-1;-webkit-print-color-adjust:exact;print-color-adjust:exact;}`
      : ''
    const win = window.open('', '_blank')
    if (!win) { toast.error('Popup bloqueado'); return }
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Contrato Social - ${f.razaoSocial||'Unipessoal'}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000}
        @media print{@page{size:A4;margin:5cm 2cm 2.5cm 2cm}body{margin:0}}
        @media screen{body{margin:5cm 2cm 2.5cm 2cm}}
        ${bg}
      </style>
    </head><body>${html}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Contrato Social – Unipessoal</h2>
          <p className="text-xs text-gray-500 mt-0.5">Preencha os dados e exporte em Word ou PDF</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm font-medium text-gray-700">Com Timbrado</span>
          <div onClick={() => set('comTimbrado', !f.comTimbrado)}
            className={`relative w-10 h-6 rounded-full transition-colors ${f.comTimbrado ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${f.comTimbrado ? 'left-5' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 border-b mb-6">
        {['1. Dados', '2. Capital & Config', '3. Prévia & Exportar'].map((label, i) => (
          <button key={i} onClick={() => setStep((i+1) as 1|2|3)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              step === i+1 ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PASSO 1 ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Dados da Empresa</h3>
            <div className="grid grid-cols-1 gap-3">
              <Lbl label="Razão Social *">
                <input className={inp} value={f.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} placeholder="EMPRESA EXEMPLO LTDA" />
              </Lbl>
              <Lbl label="Endereço da Sede (completo) *">
                <input className={inp} value={f.enderecoSede} onChange={e => set('enderecoSede', e.target.value)}
                  placeholder="Rua Israel, 90 - Rochdale - Osasco/SP - CEP: 06220-053" />
              </Lbl>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Dados do Sócio Único</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Lbl label="Nome Completo *">
                <input className={inp} value={f.socioNome} onChange={e => set('socioNome', e.target.value)} placeholder="NOME DO SÓCIO" />
              </Lbl>
              <Lbl label="Gênero">
                <select className={sel} value={f.socioGenero} onChange={e => set('socioGenero', e.target.value as 'masculino'|'feminino')}>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </Lbl>
              <Lbl label="Nacionalidade">
                <input className={inp} value={f.socioNacionalidade} onChange={e => set('socioNacionalidade', e.target.value)} placeholder="brasileiro / brasileira" />
              </Lbl>
              <Lbl label="Naturalidade (cidade/UF)">
                <input className={inp} value={f.socioNaturalidade} onChange={e => set('socioNaturalidade', e.target.value)} placeholder="São Paulo/SP" />
              </Lbl>
              <Lbl label="Estado Civil">
                <select className={sel} value={f.socioEstadoCivil} onChange={e => set('socioEstadoCivil', e.target.value)}>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viúvo">Viúvo(a)</option>
                  <option value="separado judicialmente">Separado(a) Judicialmente</option>
                  <option value="em união estável">Em União Estável</option>
                </select>
              </Lbl>
              {precisaRegime && (
                <Lbl label="Regime de Bens">
                  <select className={sel} value={f.socioRegimeBens} onChange={e => set('socioRegimeBens', e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="regime de comunhão parcial de bens">Comunhão Parcial de Bens</option>
                    <option value="regime de comunhão universal de bens">Comunhão Universal de Bens</option>
                    <option value="regime de separação total de bens">Separação Total de Bens</option>
                    <option value="regime de participação final nos aquestos">Participação Final nos Aquestos</option>
                  </select>
                </Lbl>
              )}
              <Lbl label="Profissão">
                <input className={inp} value={f.socioProfissao} onChange={e => set('socioProfissao', e.target.value)} placeholder="empresário" />
              </Lbl>
              <Lbl label="RG nº">
                <input className={inp} value={f.socioRG} onChange={e => set('socioRG', e.target.value)} placeholder="00.000.000-0" />
              </Lbl>
              <Lbl label="CPF nº">
                <input className={inp} value={f.socioCPF} onChange={e => set('socioCPF', e.target.value)} placeholder="000.000.000-00" />
              </Lbl>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="enderecoIgual" checked={f.enderecoIgual}
                    onChange={e => set('enderecoIgual', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                  <label htmlFor="enderecoIgual" className="text-sm text-gray-700 cursor-pointer">
                    Endereço residencial é o mesmo do da empresa
                  </label>
                </div>
                {!f.enderecoIgual && (
                  <Lbl label="Endereço Residencial (completo)">
                    <input className={inp} value={f.socioEnderecoRes} onChange={e => set('socioEnderecoRes', e.target.value)}
                      placeholder="Rua Exemplo, 100 - Bairro - Cidade/UF - CEP: 00000-000" />
                  </Lbl>
                )}
                {f.enderecoIgual && f.enderecoSede && (
                  <p className="text-xs text-gray-500 mt-1 pl-6">Será usado: {f.enderecoSede}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-primary px-6 py-2 text-sm">Próximo →</button>
          </div>
        </div>
      )}

      {/* ── PASSO 2 ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Capital Social</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Lbl label="Valor do Capital (R$) *">
                <input className={inp} value={f.capitalValor} onChange={e => handleCapital(e.target.value)}
                  placeholder="15.000,00" />
              </Lbl>
              <Lbl label="Extenso (auto-preenchido)">
                <input className={inp + ' bg-gray-50'} value={f.capitalExtenso}
                  onChange={e => set('capitalExtenso', e.target.value)}
                  placeholder="Quinze mil reais" />
              </Lbl>
              <Lbl label="Número de Quotas (auto-preenchido)">
                <input className={inp + ' bg-gray-50'} value={f.quotasNumero}
                  onChange={e => set('quotasNumero', e.target.value)}
                  placeholder="15.000" />
              </Lbl>
              <Lbl label="Quotas por Extenso (auto-preenchido)">
                <input className={inp + ' bg-gray-50'} value={f.quotasExtenso}
                  onChange={e => set('quotasExtenso', e.target.value)}
                  placeholder="Quinze mil" />
              </Lbl>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500">Valor unitário da quota: <strong>R$ 1,00 (Um real)</strong> — fixo conforme modelo</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Objeto Social</h3>
            <textarea className={inp + ' resize-none'} rows={4} value={f.objetoSocial}
              onChange={e => set('objetoSocial', e.target.value)}
              placeholder="Serviços combinados de escritório e apoio administrativo;" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b">Configurações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Lbl label="Enquadramento">
                <select className={sel} value={f.enquadramento} onChange={e => set('enquadramento', e.target.value as 'ME'|'EPP')}>
                  <option value="ME">ME – Microempresa</option>
                  <option value="EPP">EPP – Empresa de Pequeno Porte</option>
                </select>
              </Lbl>
              <Lbl label="Foro (cidade/UF)">
                <input className={inp} value={f.foro} onChange={e => set('foro', e.target.value)} placeholder="Osasco/SP" />
              </Lbl>
              <Lbl label="Local de Assinatura">
                <input className={inp} value={f.localAssinatura} onChange={e => set('localAssinatura', e.target.value)} placeholder="Osasco/SP" />
              </Lbl>
              <Lbl label="Data de Assinatura">
                <input className={inp} type="date" value={f.dataAssinatura} onChange={e => set('dataAssinatura', e.target.value)} />
              </Lbl>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">← Voltar</button>
            <button onClick={() => setStep(3)} className="btn-primary px-6 py-2 text-sm">Próximo →</button>
          </div>
        </div>
      )}

      {/* ── PASSO 3 ── */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">← Voltar</button>
            <button onClick={exportarDocx} disabled={exporting}
              className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60">
              {exporting && <span className="animate-spin inline-block">⟳</span>}
              Baixar Word (.docx)
            </button>
            <button onClick={imprimirPDF}
              className="px-5 py-2 text-sm border-2 border-primary-600 text-primary-600 rounded hover:bg-primary-50 font-medium">
              Imprimir / Gerar PDF
            </button>
            <span className="text-xs text-gray-400">{f.comTimbrado ? '✓ Com timbrado' : '○ Sem timbrado'}</span>
          </div>

          <div className="border rounded-lg bg-white shadow-sm overflow-auto"
            style={{ maxHeight: '72vh', padding: '5cm 2cm 2.5cm 2cm', background: '#fff' }}>
            <div dangerouslySetInnerHTML={{ __html: gerarHTML(f) }} />
          </div>
        </div>
      )}
    </div>
  )
}
