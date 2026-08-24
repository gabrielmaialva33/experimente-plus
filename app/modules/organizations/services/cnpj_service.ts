import BadRequestException from '#exceptions/bad_request_exception'

export default class CnpjService {
  normalizeAndValidate(value: string): string {
    const normalized = value.replace(/\D/g, '')

    if (!this.isValid(normalized)) {
      throw new BadRequestException('CNPJ is invalid')
    }

    return normalized
  }

  isValid(value: string): boolean {
    if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) {
      return false
    }

    const firstDigit = this.calculateDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    const secondDigit = this.calculateDigit(
      `${value.slice(0, 12)}${firstDigit}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    )

    return value.endsWith(`${firstDigit}${secondDigit}`)
  }

  private calculateDigit(value: string, weights: number[]): number {
    const sum = value
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
}
