export const mockAppointments: any[] = []
export const mockOrders: any[] = []

let nextApptId = 100
let nextOrderId = 5000

const MOCK_PRODUCT_NAMES: Record<string, string> = {
  '1': 'شامبو احترافي', '2': 'كريم ترطيب', '3': 'زيت شعر أرغان',
  '4': 'مثبت شعر', '5': 'طلاء أظافر',
}

export function addMockAppointment(data: any): any {
  const appt = { ...data, id: nextApptId++, status: data.status || 'pending' }
  mockAppointments.unshift(appt)
  return appt
}

export function addMockOrder(data: any): any {
  const items = (data.items || []).map((item: any) => ({
    product_id: item.product_id || '1',
    name: MOCK_PRODUCT_NAMES[String(item.product_id)] || 'منتج',
    quantity: item.quantity || 1,
    unit_price: item.price || 0,
  }))
  const total = data.total || items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
  const order = {
    id: nextOrderId++, ...data, items,
    total, items_count: items.length,
    status: data.status || 'pending',
  }
  mockOrders.unshift(order)
  return order
}
