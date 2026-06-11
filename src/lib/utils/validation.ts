export function validateSriLankanPhone(phone: string): boolean {
  return /^(\+94|0)[0-9]{9}$/.test(phone.replace(/\s/g, ''))
}

export function phoneValidationMessage(): string {
  return 'Enter a valid Sri Lankan phone (e.g. 0771234567 or +94771234567)'
}
