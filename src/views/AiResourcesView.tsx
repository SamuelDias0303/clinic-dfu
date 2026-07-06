import React from 'react';
import { motion } from 'motion/react';
import { Bot, CheckCircle2, ExternalLink, FileText, GitBranch, Network } from 'lucide-react';

const resources = [
  {
    name: 'Graphify',
    description: 'Gera um grafo navegavel do codigo e ajuda a responder perguntas amplas sobre arquitetura.',
    local: 'npm run graphify',
    status: 'Script local configurado',
    href: 'https://github.com/safishamsi/graphify',
    icon: Network,
  },
  {
    name: 'Awesome Design MD',
    description: 'Padrao de DESIGN.md adaptado para manter a UI clinica consistente.',
    local: 'DESIGN.md',
    status: 'Contrato visual criado',
    href: 'https://github.com/voltagent/awesome-design-md',
    icon: FileText,
  },
  {
    name: 'Get Shit Done',
    description: 'Fluxo leve de planejamento por requisitos, roadmap, estado e verificacao.',
    local: '.planning/',
    status: 'GSD-lite versionado',
    href: 'https://github.com/gsd-build/get-shit-done',
    icon: GitBranch,
  },
  {
    name: 'Everything Claude Code / ECC',
    description: 'Boas praticas de agentes: pesquisa primeiro, contexto enxuto, verificacao e seguranca.',
    local: 'AGENTS.md',
    status: 'Guia de agente criado',
    href: 'https://github.com/affaan-m/everything-claude-code',
    icon: Bot,
  },
];

export default function AiResourcesView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Recursos IA</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm mt-1 font-medium">
            Ferramentas e guias versionados para evoluir o Clinic DFU com agentes.
          </p>
        </div>
        <a
          href="https://github.com/affaan-m/everything-claude-code"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
        >
          <ExternalLink size={16} />
          Referencias
        </a>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {resources.map((resource) => {
          const Icon = resource.icon;

          return (
            <section
              key={resource.name}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{resource.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-6">{resource.description}</p>
                  </div>
                </div>
                <a
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-slate-400 hover:text-primary transition-colors shrink-0"
                  title={`Abrir ${resource.name}`}
                >
                  <ExternalLink size={18} />
                </a>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Local</div>
                  <div className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100 break-all">{resource.local}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-bold">{resource.status}</span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Como usar no desenvolvimento</h3>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {['Leia DESIGN.md antes de alterar UI.', 'Use .planning/ para features maiores.', 'Rode npm run lint e npm run build antes de entregar.'].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
