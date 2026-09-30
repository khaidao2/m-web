/* Brand cards for "Hiểu sản phẩm". USPs come from the project doc; images are optional
   files in /public/brand/<slug>.jpg and fall back to a vector tile. */
export type Brand = {
  slug: string
  name: string
  category: string
  color: string
  icon: 'flame' | 'droplet' | 'soup' | 'coffee' | 'zap' | 'glass-water'
  usp: string[]
  pair?: string
}

export const BRANDS: Brand[] = [
  { slug: 'chin-su', name: 'CHIN-SU', category: 'Gia vị', color: '#d71920', icon: 'flame',
    usp: ['Tương ớt Chin-su ớt chín cây', 'Nước mắm Chin-su cá hồi, cá cơm biển Đông (cao cấp)'], pair: 'Mì + Tương ớt' },
  { slug: 'nam-ngu', name: 'Nam Ngư', category: 'Gia vị', color: '#b3261e', icon: 'droplet',
    usp: ['Siêu Tiết Kiệm — mã phải win tại BHX', 'Đệ Nhị 900 bán tốt tại BHX', 'Cá cơm tươi cao cấp (Phú Quốc) & nhãn vàng'], pair: 'Nước mắm + Hạt nêm' },
  { slug: 'omachi', name: 'Omachi', category: 'Thực phẩm tiện lợi', color: '#e0442a', icon: 'soup',
    usp: ['Sợi mì khoai tây', 'Spaghetti, bò, tôm, sườn là các vị core'], pair: 'Mì + Tương ớt' },
  { slug: 'kokomi', name: 'Kokomi', category: 'Thực phẩm tiện lợi', color: '#f08c00', icon: 'soup',
    usp: ['Kokomi 90 là mã core tại BHX'], pair: 'Mì + Tương ớt' },
  { slug: 'vinacafe', name: 'Vinacafé', category: 'Cà phê', color: '#6b3e1e', icon: 'coffee',
    usp: ['Một số mã đổi packsize: so số gói và giá/gói cho khách'] },
  { slug: 'wake-up-247', name: 'Wake-Up 247', category: 'Đồ uống', color: '#1d8a3a', icon: 'zap',
    usp: ['Nguồn cung Bev có thể gián đoạn: kiểm tra tồn trước khi hứa hàng'] },
  { slug: 'vinh-hao', name: 'Vĩnh Hảo', category: 'Nước uống', color: '#1769c2', icon: 'glass-water',
    usp: ['Nước khoáng: gợi ý kèm giỏ hàng bữa ăn gia đình'] },
]

export const SALES_STEPS = [
  { title: 'Chào hỏi & tiếp cận', text: 'Chủ động, thân thiện trong 2 giây đầu khi khách dừng tại quầy.' },
  { title: 'Khai thác nhu cầu', text: 'Hỏi câu mở, lắng nghe và nhắc lại ý chính của khách.' },
  { title: 'Gợi ý sản phẩm chủ lực', text: 'Chọn USP phù hợp đúng nhu cầu: Mì, Gia vị là trọng tâm.' },
  { title: 'Tư vấn sản phẩm bổ trợ', text: 'Gợi ý combo đúng lúc khách vừa chọn xong, tôn trọng lựa chọn.' },
  { title: 'Chốt đơn', text: 'Xác nhận lựa chọn, số lượng và tổng chi; không tạo khan hiếm giả.' },
]
