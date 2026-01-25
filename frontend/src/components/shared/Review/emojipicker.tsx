"use client";

import { useTranslations } from 'next-intl';
import { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';

import { IReviewFeedback } from '@/constants/types';
import { createReview } from '@/services/reviewsApi';
import removeUrls from '@/utils/sanitize';
import { FileInput, TextArea } from '../Forms/Inputs/Inputs';
import { AppContext } from '../../../../context/AppContextProvider';
import logger from '../../../../logger.config.mjs';

interface Emoji {
  name: string;
  unicode: string;
  code: string;
  value: number;
}

export default function EmojiPicker(props: any) {
  const t = useTranslations();

  const despairEmoji: Emoji = { name: t('SHARED.REACTION_RATING.EMOTIONS.DESPAIR'), unicode: "😠", code: ":despair:", value: 0 };
  const emojis: Emoji[] = [
    { name: t('SHARED.REACTION_RATING.EMOTIONS.SAD'), unicode: "🙁", code: ":sad_face:", value: 2 },
    { name: t('SHARED.REACTION_RATING.EMOTIONS.OKAY'), unicode: "🙂", code: ":okay_face:", value: 3 },
    { name: t('SHARED.REACTION_RATING.EMOTIONS.HAPPY'), unicode: "😃", code: ":happy_face:", value: 4 },
    { name: t('SHARED.REACTION_RATING.EMOTIONS.DELIGHT'), unicode: "😍", code: ":delight_face:", value: 5 }
  ];

  const [dbReviewFeedback, setDbReviewFeedback] = useState<IReviewFeedback | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string>(dbReviewFeedback?.image || '');
  const [isSaveEnabled, setIsSaveEnabled] = useState<boolean>(false);
  const [comments, setComments] = useState('');
  const [reviewEmoji, setReviewEmoji] = useState<number | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<number | null>(null);

  const { showAlert, setAlertMessage, isSaveLoading, setIsSaveLoading } = useContext(AppContext);

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewImage(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (dbReviewFeedback?.image) {
      setPreviewImage(dbReviewFeedback.image);
    }
  }, [dbReviewFeedback]);

  useEffect(() => {
    const noReview = comments === '' && reviewEmoji === null && file === null;
    setIsSaveEnabled(!noReview);
    props.setIsSaveEnabled(!noReview)
  }, [comments, reviewEmoji, file]);


  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComments(e.target.value);
  };

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSaveLoading) return;
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewImage(objectUrl);
      setIsSaveEnabled(true);
    }
  };

  const resetReview = () => {
    setSelectedEmoji(null);
    setReviewEmoji(null);
    setComments('');
    setPreviewImage('');
    setFile(null);
    setIsSaveEnabled(false);
    props.setIsSaveEnabled(false);
  }

  const handleSave = async () => {
    try {
      if (props.currentUser) {
        if (props.currentUser.pi_uid === props.userId) {
          return toast.error(t('SCREEN.REPLY_TO_REVIEW.VALIDATION.SELF_REVIEW_NOT_POSSIBLE'));
        }
        if (reviewEmoji === null) {
          return toast.warn(t('SHARED.REACTION_RATING.VALIDATION.SELECT_EMOJI_EXPRESSION'));
        } else {
          setIsSaveEnabled(false);
          setIsSaveLoading(true);
          setAlertMessage(t('SHARED.SAVING_SCREEN_MESSAGE'));
          const formDataToSend = new FormData();
          formDataToSend.append('comment', removeUrls(comments));
          formDataToSend.append('rating', reviewEmoji.toString());
          formDataToSend.append('review_receiver_id', props.userId);
          formDataToSend.append('reply_to_review_id', props.replyToReviewId || '');

          if (file) {
            formDataToSend.append('image', file);
          } else {
            formDataToSend.append('image', '');
          }

          const newReview = await createReview(formDataToSend);
          if (newReview) {
            setAlertMessage(null);
            resetReview();
            props.setReload(true);
            props.refresh();
          } else {
            setAlertMessage(t('SHARED.REACTION_RATING.VALIDATION.UNSUCCESSFUL_REVIEW_SUBMISSION'));
          }
        }
      } else {
        toast.error(t('SHARED.VALIDATION.SUBMISSION_FAILED_USER_NOT_AUTHENTICATED'));
      }
    } catch (error) {
      logger.error('Error saving review:', error);
    } finally {
      setIsSaveLoading(false);
      setAlertMessage(null);
    }
  };
  
  const handleEmojiClick = (emojiValue: number) => {
    if (isSaveLoading) return;
    if (selectedEmoji === emojiValue) {
      setSelectedEmoji(null);
      setReviewEmoji(null);
    } else {
      setSelectedEmoji(emojiValue);
      setReviewEmoji(emojiValue);
    }
  };

  const getReview = (reviews: { [key: string]: number } | undefined, emojiName: string): number | undefined => {
    if (reviews) return reviews[emojiName];
    return undefined;
  };

  const emojiBtnClass = 'rounded-md w-full outline outline-[0.5px] flex justify-center items-center cursor-pointer p-1'
  
  // حساب عدد التقييمات المتبقية (بناءً على التعديلات في Backend)
  const reviewsLeft = props.seller ? Math.max(0, 10 - (props.seller.verification_count || 0)) : 10;

  return (
    <div className="mb-3">
      <p>{t('SCREEN.REPLY_TO_REVIEW.FACE_SELECTION_REVIEW_MESSAGE')}</p>
      <div className='flex sm:overflow-hidden overflow-auto gap-3 w-full text-center justify-center my-2'>
        <div className='bg-[#DF2C2C33] flex-grow-[0.5] rounded-md p-2'>
          <p className='text-red-700 mb-2'>{t('SHARED.REACTION_RATING.UNSAFE')}</p>
          <div
            onClick={() => !props.clickDisabled ? handleEmojiClick(despairEmoji.value) : undefined}
            className={`${selectedEmoji !== despairEmoji.value ? 'bg-red-200' : 'bg-red-700'} outline-[#DF2C2C] ${emojiBtnClass}`}
          >
            <div>
              <p className='text-3xl md:py-2 py-1'>{despairEmoji.unicode}</p>
              <p className={`md:text-[16px] text-[14px] ${selectedEmoji == despairEmoji.value && 'text-white'}`}>{despairEmoji.name}</p>
              {props.reviews && <p>{getReview(props.reviews, despairEmoji.name)}</p>}
            </div>
          </div>
        </div>
        <div className='bg-[#3D924A8A] rounded-[10px] flex-grow-[4.3] flex-4 p-2 text-center text-white'>
          <p className='mb-2'>{t('SHARED.REACTION_RATING.TRUSTWORTHY')}</p>
          <div id='emoji-picker' className='flex gap-3 justify-center'>
            {emojis.map((emoji, index) => (
              <li
                key={index}
                onClick={() => !props.clickDisabled ? handleEmojiClick(emoji.value) : undefined}
                className={`${selectedEmoji !== emoji.value ? 'bg-transparent' : 'bg-primary'} outline-[#090C49] ${emojiBtnClass}`}
              >
                <div>
                  <p className='text-3xl md:py-2 py-1'>{emoji.unicode}</p>
                  <p className='md:text-[16px] text-[14px]'>{emoji.name}</p>
                  {props.reviews && <p>{getReview(props.reviews, emoji.name)}</p>}                                 
                </div>
              </li>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-2">
        <TextArea placeholder={t('SCREEN.BUY_FROM_SELLER.ADDITIONAL_COMMENTS_PLACEHOLDER')} 
        value={comments} 
        onChange={handleCommentsChange} 
        maxLength={250}
        disabled={isSaveLoading}
        />
      </div>
      <div className="mb-2">
        <FileInput 
          label={t('SHARED.PHOTO.MISC_LABELS.REVIEW_FEEDBACK_IMAGE_LABEL')}
          describe={t('SHARED.PHOTO.UPLOAD_PHOTO_REVIEW_PLACE_HOLDER')} 
          imageUrl={previewImage} 
          handleAddImage={handleAddImage} 
        />
      </div>

      {/* الجزء المضاف: حافز التوثيق للمجتمع */}
      {props.seller && !props.seller.is_verified && reviewsLeft > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md mb-4 flex items-center gap-2">
          <span className="text-xl">✨</span>
          <p className="text-sm text-blue-800">
             باقي {reviewsLeft} تقييمات إيجابية ليصبح هذا التاجر موثقاً بالعلامة الزرقاء!
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="mb-7">
        <button
          onClick={handleSave}
          disabled={!isSaveEnabled}
          className={`${isSaveEnabled ? 'opacity-100' : 'opacity-50'} px-6 py-2 bg-primary text-white text-xl rounded-md flex justify-right ms-auto text-[15px]`}> 
            {t('SHARED.SAVE')}
        </button>
      </div>
    </div>
  );  
}
