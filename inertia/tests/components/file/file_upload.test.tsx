import type { ChangeEvent, HTMLAttributes, InputHTMLAttributes } from 'react'

import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FileUpload } from '~/components/file'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  clearError: vi.fn(),
  reload: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  router: { reload: mocks.reload },
}))

vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[], rejections: never[]) => void }) => ({
    getRootProps: (): HTMLAttributes<HTMLDivElement> => ({}),
    getInputProps: (): InputHTMLAttributes<HTMLInputElement> => ({
      'type': 'file',
      'aria-label': 'Selecionar arquivo',
      'onChange': (event: ChangeEvent<HTMLInputElement>) =>
        onDrop(Array.from(event.target.files ?? []), []),
    }),
    isDragActive: false,
  }),
}))

vi.mock('~/hooks/use_api', () => ({
  useApi: () => ({
    client: { upload: mocks.upload },
    loading: false,
    error: null,
    clearError: mocks.clearError,
    request: async <T,>(callback: () => Promise<T>) => callback(),
  }),
}))

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upload.mockResolvedValue({
      url: 'https://files.example.test/cardapio.png',
      clientName: 'cardapio',
      fileCategory: 'image',
      fileType: 'image/png',
      size: 2048,
      extname: 'png',
    })
  })

  it('presents the human category before the technical MIME after upload', async () => {
    const { user } = render(<FileUpload />)
    const file = new File(['image'], 'cardapio.png', { type: 'image/png' })

    await user.upload(screen.getByLabelText('Selecionar arquivo'), file)
    await user.click(screen.getByRole('button', { name: 'Enviar arquivo' }))

    expect((await screen.findByText('Categoria:')).parentElement).toHaveTextContent(
      'Categoria: Imagem'
    )
    expect(screen.getByText('Formato técnico:').parentElement).toHaveTextContent(
      'Formato técnico: image/png'
    )
    expect(mocks.reload).toHaveBeenCalledWith({ only: ['files'] })
  })
})
