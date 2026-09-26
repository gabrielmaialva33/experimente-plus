import { describe, expect, it } from 'vitest'

import { ImageDropZone } from '~/components/portal/image_drop_zone'
import { fireEvent, render, screen } from '~/tests/test_utils'

describe('ImageDropZone', () => {
  it('is a labelled file input that names the chosen image and forgets it on reset', async () => {
    const { user, container } = render(
      <form>
        <label htmlFor="photo">Imagem</label>
        <ImageDropZone id="photo" required />
      </form>
    )

    const input = screen.getByLabelText('Imagem')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('name', 'file')
    expect(input).toBeRequired()
    expect(screen.getByText('Arraste uma imagem ou clique para escolher')).toBeVisible()

    await user.upload(input, new File(['x'], 'fachada.jpg', { type: 'image/jpeg' }))
    expect(screen.getByText('fachada.jpg')).toBeVisible()

    fireEvent.reset(container.querySelector('form')!)
    expect(screen.queryByText('fachada.jpg')).not.toBeInTheDocument()
  })
})
