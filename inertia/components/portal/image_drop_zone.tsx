import { ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '~/lib/utils'

interface ImageDropZoneProps {
  'id': string
  'name'?: string
  'required'?: boolean
  'disabled'?: boolean
  'hint'?: string
  'aria-describedby'?: string
  'aria-required'?: boolean | 'false' | 'true'
  'aria-invalid'?: boolean | 'false' | 'true'
}

/**
 * The partner portal's one way to pick an image (web audit W76). The real file input
 * covers the whole area, so clicking, the keyboard and dropping a file from the
 * desktop all reach it natively and the surrounding form still posts it as `file`.
 */
export function ImageDropZone({
  id,
  name = 'file',
  required = false,
  disabled = false,
  hint = 'JPEG, PNG ou WebP de até 10 MB',
  ...aria
}: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const clear = () => setFileName(null)
    form.addEventListener('reset', clear)
    return () => form.removeEventListener('reset', clear)
  }, [])

  return (
    <div
      className={cn(
        'relative flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 motion-reduce:transition-none',
        dragging
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-muted/20 hover:border-primary/60',
        disabled && 'opacity-60'
      )}
    >
      <ImagePlus aria-hidden="true" className="size-6 text-primary" />
      <p className="text-sm font-semibold" aria-hidden="true">
        {fileName ?? 'Arraste uma imagem ou clique para escolher'}
      </p>
      <p className="text-xs text-muted-foreground" aria-hidden="true">
        {fileName ? 'Clique para trocar a imagem' : hint}
      </p>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required={required}
        disabled={disabled}
        {...aria}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? null)}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={() => setDragging(false)}
      />
    </div>
  )
}
