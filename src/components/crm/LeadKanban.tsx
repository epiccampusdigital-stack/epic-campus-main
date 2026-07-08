'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  getCourseLabel,
  getDaysInStage,
  getPipelineStages,
  getRecommendedPathLabel,
  getSourceLabel,
} from '@/lib/crm/helpers'
import type { Lead, LeadStatus } from '@/types'

interface LeadKanbanProps {
  leads: Lead[]
  loading?: boolean
  onEdit: (lead: Lead) => void
  onRefresh: () => void
}

export default function LeadKanban({
  leads,
  loading,
  onEdit,
  onRefresh,
}: LeadKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const stages = getPipelineStages()

  async function moveLead(leadId: string, status: LeadStatus) {
    await updateDoc(doc(db, 'leads', leadId), { status })
    onRefresh()
  }

  function handleDragStart(e: React.DragEvent, leadId: string) {
    setDraggingId(leadId)
    e.dataTransfer.setData('text/plain', leadId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    if (leadId) {
      await moveLead(leadId, status)
    }
    setDraggingId(null)
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((s) => (
          <div
            key={s.status}
            className="min-w-[260px] flex-1 animate-pulse rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-4"
          >
            <div className="mb-4 h-5 w-32 rounded bg-[#DDE3EC] dark:bg-white/10" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-[#DDE3EC] dark:bg-white/10" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const columnLeads = leads.filter((l) => l.status === stage.status)

        return (
          <div
            key={stage.status}
            className="flex min-w-[260px] max-w-[280px] flex-1 flex-col rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-[#F5F7FB] dark:bg-white/[0.04]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.status)}
          >
            <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 px-4 py-3 rounded-t-xl">
              <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                {stage.label}
              </h3>
              <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-white/10 px-2 py-0.5 font-inter text-xs font-semibold text-[#0B3D6B] dark:text-white/80">
                {columnLeads.length}
              </span>
            </div>

            <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto p-3">
              {columnLeads.length === 0 ? (
                <p className="py-6 text-center font-inter text-xs text-[#5A6A7A] dark:text-white/40">
                  Drop leads here
                </p>
              ) : (
                columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => onEdit(lead)}
                    className={`cursor-grab rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
                      draggingId === lead.id ? 'opacity-50' : ''
                    }`}
                  >
                    <p className="font-jakarta text-sm font-semibold text-[#0D1B2A] dark:text-white">
                      {lead.name}
                      {lead.source === 'destination-picker' && (
                        <span className="ml-1.5 rounded-full bg-[#E8A020]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#0B3D6B] dark:text-[#E8A020]">
                          Quiz
                        </span>
                      )}
                    </p>
                    <p className="mt-1 truncate font-inter text-xs text-[#5A6A7A] dark:text-white/60">
                      {getCourseLabel(lead.courseId)}
                      {lead.recommendedPath && (
                        <span className="text-[#E8A020]">
                          {' '}
                          · {getRecommendedPathLabel(lead.recommendedPath)}
                        </span>
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded bg-[#F5F7FB] dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-[#5A6A7A] dark:text-white/60">
                        {getSourceLabel(lead.source)}
                      </span>
                      {lead.agentName && (
                        <span className="rounded bg-[#E8A020]/15 px-1.5 py-0.5 text-[10px] text-[#0B3D6B] dark:text-[#E8A020]">
                          {lead.agentName}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-inter text-[10px] text-[#5A6A7A] dark:text-white/40">
                      {getDaysInStage(lead.createdAt, lead.lastContact)} days in
                      stage
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
