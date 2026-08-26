import { MessageSquareText } from 'lucide-react'

import { EditorSection } from '~/components/portal/editor_section'
import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { Badge } from '~/components/ui/badge'
import type { FeedbackTargets } from './types'

interface FeedbackSectionProps {
  targets: FeedbackTargets
  organizationId: number
  establishmentId: number
}

export function FeedbackSection({
  targets,
  organizationId,
  establishmentId,
}: FeedbackSectionProps) {
  return (
    <EditorSection
      id="feedback"
      icon={MessageSquareText}
      title="Feedback do piloto"
      description="Registre dificuldades, dúvidas e melhorias percebidas durante o uso real do editor."
      toolbar={
        <Badge variant="secondary" appearance="light" size="sm">
          Opcional
        </Badge>
      }
    >
      <div className="p-5 sm:p-6">
        <PilotFeedbackForm
          targets={targets}
          context="establishment"
          organizationId={organizationId}
          establishmentId={establishmentId}
          compact
        />
      </div>
    </EditorSection>
  )
}
