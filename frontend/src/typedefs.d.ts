declare interface Window {
  Pi: any;
}

// Declaration for leaflet-control-geocoder
declare module 'leaflet-control-geocoder/dist/Control.Geocoder.js' {
  const Geocoder: any;
  export default Geocoder;
}

// إضافة تعريفات المتجر لضمان عمل المزايا الجديدة
interface ISeller {
  seller_id: string;
  name: string;
  is_verified: boolean; // الحقل الجديد
  verification_count: number; // الحقل الجديد
  average_rating: any;
  image?: string;
  description?: string;
  address?: string;
  // أضف أي حقول أخرى تظهر لك في الكود
}
