import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';

import TrustMeter from '@/components/shared/Review/TrustMeter';
import { translateSellerCategory } from '@/utils/translate';
import { Button } from '../Forms/Buttons/Buttons';

import logger from '../../../../logger.config.mjs';

const MapMarkerPopup = ({ seller }: { seller: any }) => {
  const t = useTranslations();
  const locale = useLocale();
  
  const imageUrl =
    seller.image && seller.image.trim() !== '' 
      ? seller.image 
      : '/images/logo.svg';

  const truncateChars = (text: string, maxChars: number): string => {
    return text.length > maxChars ? text.slice(0, maxChars) + '...' : text;
  };

  logger.info('Rendering MapMarkerPopup for seller:', { seller });

  return (
    <div style={{ position: 'relative', zIndex: 20, padding: '10px' }}>
      {/* Seller name and type - Close with a small gap */}
      <div style={{ textAlign: 'center', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <h2 
            style={{
              fontWeight: 'bold',
              fontSize: '15px',
              marginBottom: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {truncateChars(seller.name, 12)}
          </h2>
          
          {/* علامة التوثيق الزرقاء تظهر فقط إذا كان التاجر موثقاً */}
          {seller.is_verified && (
            <svg 
              viewBox="0 0 24 24" 
              style={{ width: '16px', height: '16px', color: '#3B82F6' }} 
              fill="currentColor"
            >
              <path d="M22.5 12.5c0-1.58-.88-2.95-2.18-3.65.25-1.11.13-2.31-.41-3.33s-1.49-1.74-2.61-2.02c-.7-.18-1.42-.19-2.11-.04-.69-1.29-1.93-2.21-3.39-2.43-1.45-.22-2.9.27-3.92 1.29l-.2.2c-.62-.16-1.28-.21-1.92-.15-1.12.11-2.17.61-2.98 1.42-.81.81-1.31 1.86-1.42 2.98-.06.64-.01 1.3.15 1.92l-.2.2c-1.02 1.02-1.51 2.47-1.29 3.92.22 1.46 1.14 2.7 2.43 3.39-.15.69-.14 1.41.04 2.11.28 1.12 1 2.07 2.02 2.61.59.31 1.23.49 1.88.54.34.86.95 1.59 1.74 2.07 1.1.66 2.42.78 3.61.33 1.19-.45 2.12-1.4 2.53-2.58.5.08 1.01.09 1.51.02 1.12-.11 2.17-.61 2.98-1.42.81-.81 1.31-1.86 1.42-2.98.07-.64.02-1.3-.14-1.92l.2-.2c1.02-1.02 1.51-2.47 1.29-3.92-.12-.76-.44-1.46-.92-2.04.44-.57.75-1.25.89-1.97.04-.21.06-.42.06-.63zM10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          )}
        </div>
        
        {seller.seller_type && (
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '0px', marginBottom: '4px' }}>
            {translateSellerCategory(seller.seller_type, t)}
          </p>
        )}
      </div>

      {/* ... باقي الكود كما هو بدون تغيير ... */}
      <div style={{ width: '150px', height: '70px', overflow: 'hidden', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Image
          src={imageUrl}
          alt="Seller Image"
          width={150}
          height={70}
          style={{ objectFit: 'contain', width: '100%', height: '100%' }}
        />
      </div>

      <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
        Trust-o-meter
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '8px' }}>
        <TrustMeter ratings={seller.trust_meter_rating} />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5px' }}>
        <Link
          href={`/${locale}/seller/sale-items/${seller.seller_id}`}
          style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
        >
          <Button
            label={t('SHARED.BUY')}
            styles={{ color: '#ffc153', paddingTop: '6px', paddingBottom: '6px', width: '35%', textAlign: 'center' }}
          />
        </Link>
      </div>
    </div>
  );
};

export default MapMarkerPopup;
