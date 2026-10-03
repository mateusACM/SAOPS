// ==========================================
// PRESTADORES.JS - Catálogo local de negócios
// (o backend do TCC só tem a entidade "agendamentos",
// então os prestadores ficam neste catálogo no frontend)
// ==========================================

const PRESTADORES = [
  {
    id: 'vintage',
    nome: 'Barbearia Vintage',
    estrelas: '4.8',
    avaliacoes: 132,
    categoria: 'Barbearia',
    bairro: 'Centro',
    endereco: 'Rua das Palmeiras, 120 - Osasco',
    funcionamento: 'Seg a Sáb, 09:00 às 19:00',
    sobre: 'Barbearia tradicional com mais de 10 anos de atendimento no bairro. Especializada em cortes clássicos e barba.',
    servicos: [
      'Corte de cabelo - 40 min - R$ 45',
      'Barba - 25 min - R$ 30',
      'Corte + barba - 60 min - R$ 65'
    ],
    avaliacoes_recentes: [
      { autor: 'Rodrigo A.', nota: '5 estrelas', texto: 'Atendimento rápido e caprichado.' },
      { autor: 'Marcos V.', nota: '4 estrelas', texto: 'Bom atendimento, só demorou um pouco.' }
    ]
  },
  {
    id: 'bella',
    nome: 'Studio Bella Hair',
    estrelas: '4.6',
    avaliacoes: 98,
    categoria: 'Salão de beleza',
    bairro: 'Jardim Elite',
    endereco: 'Av. das Flores, 450 - Jardim Elite',
    funcionamento: 'Seg a Sáb, 09:00 às 20:00',
    sobre: 'Salão especializado em coloração, escova e estética capilar, com equipe premiada na região.',
    servicos: [
      'Corte + escova - 60 min - R$ 80',
      'Coloração - 90 min - R$ 150',
      'Manicure - 40 min - R$ 40'
    ],
    avaliacoes_recentes: [
      { autor: 'Juliana P.', nota: '5 estrelas', texto: 'Melhor escova que já fiz!' },
      { autor: 'Camila R.', nota: '4 estrelas', texto: 'Ótimo atendimento, voltarei.' }
    ]
  },
  {
    id: 'vida',
    nome: 'Clínica Vida & Saúde',
    estrelas: '4.9',
    avaliacoes: 210,
    categoria: 'Clínica',
    bairro: 'Centro',
    endereco: 'Rua Central, 300 - Centro',
    funcionamento: 'Seg a Sex, 08:00 às 18:00',
    sobre: 'Clínica multidisciplinar com foco em bem-estar, estética e saúde preventiva.',
    servicos: [
      'Consulta avaliativa - 30 min - R$ 120',
      'Limpeza de pele - 60 min - R$ 140',
      'Massagem relaxante - 50 min - R$ 110'
    ],
    avaliacoes_recentes: [
      { autor: 'Ana C.', nota: '5 estrelas', texto: 'Estrutura impecável e pontualidade.' },
      { autor: 'Paulo H.', nota: '5 estrelas', texto: 'Profissionais muito atenciosos.' }
    ]
  }
];

function buscarPrestadorPorId(id) {
  return PRESTADORES.find((p) => p.id === id) || null;
}
