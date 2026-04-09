'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, isApiError } from '@/lib/api';
import { previewFromFile } from '@/lib/images';
import { getReviewContext, submitReview } from '@/services/review';
import type { ReviewContext } from '@/types/api';

const PUBLIC_QUESTIONS = [
  'Which part of the process did Renaissance Park explain clearly?',
  'How did the staff help your family during the service?',
  'What stood out the most about the interment service?',
  'What made Renaissance Park practical or easy for your family?',
  'What gave you peace of mind after the service?'
];

const PRIVATE_QUESTIONS = [
  'Which part of the service felt slow or rushed?',
  'When did you feel unsure about what to do next?',
  'What was explained late or not clear?',
  'Was there a time when staff instructions were confusing?',
  'When did your family feel most stressed?',
  'Which rule or requirement was surprising or hard to follow?',
  'Was there anything about the setup, chairs, tents, or sound that could be better?',
  'Looking back, what would have made the service smoother for your family?'
];

function shuffledQuestion(questions: string[]) {
  return [...questions].sort(() => 0.5 - Math.random());
}

function getNames(records: ReviewContext[]) {
  return records.map((record) => record.occupant || record.name1 || '').filter(Boolean);
}

export default function ReviewPage({ documentNo }: { documentNo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState<'en' | 'tl' | 'hil'>('en');
  const [occupantStatus, setOccupantStatus] = useState<'valid' | 'wrongLink' | 'expired'>('wrongLink');
  const [occupantMessage, setOccupantMessage] = useState('');
  const [occupantNames, setOccupantNames] = useState<string[]>([]);
  const [intermentDate, setIntermentDate] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [privateFaqAnswer, setPrivateFaqAnswer] = useState('');
  const [privateOthers, setPrivateOthers] = useState('');
  const [selectedFocusQuestion, setSelectedFocusQuestion] = useState('');
  const [selectedPrivateFaq, setSelectedPrivateFaq] = useState('');
  const [focusPool, setFocusPool] = useState<string[]>([]);
  const [privatePool, setPrivatePool] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [privateIndex, setPrivateIndex] = useState(0);
  const [fbFile, setFbFile] = useState<File | null>(null);
  const [fbPreview, setFbPreview] = useState<string | null>(null);
  const [googleFile, setGoogleFile] = useState<File | null>(null);
  const [googlePreview, setGooglePreview] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const publicQuestions = shuffledQuestion(PUBLIC_QUESTIONS);
    const privateQuestions = shuffledQuestion(PRIVATE_QUESTIONS);
    setFocusPool(publicQuestions);
    setPrivatePool(privateQuestions);
    setSelectedFocusQuestion(publicQuestions[0]);
    setSelectedPrivateFaq(privateQuestions[0]);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const records = await getReviewContext(documentNo);
        if (!records.length) {
          setOccupantStatus('wrongLink');
          setOccupantMessage('The link is invalid or the interred name does not exist.');
          return;
        }
        setOccupantNames(getNames(records));
        setIntermentDate(formatDate(records[0]?.date_interment));
        setOccupantStatus('valid');
      } catch (errorValue) {
        if (isApiError(errorValue) && errorValue.status === 403) {
          setOccupantStatus('expired');
          setOccupantMessage('This review link has expired.');
        } else {
          setOccupantStatus('wrongLink');
          setOccupantMessage('No valid record found. The review form is disabled.');
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [documentNo]);

  const headerText = useMemo(() => {
    if (language === 'tl') return 'Pinahahalagahan namin ang iyong puna';
    if (language === 'hil') return 'Ginatamdan namon ang imo nga feedback';
    return 'We appreciate your feedback';
  }, [language]);

  const subHeaderText = useMemo(() => {
    if (language === 'tl') return 'Ilang pamilya ang nag-iiwan ng maikling rekomendasyon sa aming pahina. Maaari ka ring magbahagi ng pribadong puna o alalahanin.';
    if (language === 'hil') return 'May mga pamilya nga nagabutang sang gamay nga rekomendasyon sa amon nga pahina. Pwede ka man maghatag sang pribado nga feedback.';
    return 'Some families leave a short recommendation on our page. You may also share private feedback or concerns with us.';
  }, [language]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>, type: 'fb' | 'google') {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = await previewFromFile(file, 900);
    if (type === 'fb') {
      setFbFile(file);
      setFbPreview(preview);
    } else {
      setGoogleFile(file);
      setGooglePreview(preview);
    }
  }

  function nextPublicQuestion() {
    const nextIndex = (focusIndex + 1) % focusPool.length;
    setFocusIndex(nextIndex);
    setSelectedFocusQuestion(focusPool[nextIndex]);
  }

  function nextPrivateQuestion() {
    const nextIndex = (privateIndex + 1) % privatePool.length;
    setPrivateIndex(nextIndex);
    setSelectedPrivateFaq(privatePool[nextIndex]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!reviewerName.trim() || !contactNumber.trim()) {
      setError('Please fill in your name and contact number.');
      setStep(1);
      return;
    }

    if (!fbFile && !googleFile) {
      setError('Please upload at least one screenshot.');
      setStep(2);
      return;
    }

    if (!selectedFocusQuestion || !selectedPrivateFaq) {
      setError('Please select both public and private questions.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('document_no', documentNo);
      formData.append('reviewer_name', reviewerName.trim());
      formData.append('contact_number', contactNumber.trim());
      formData.append('selected_public_question', selectedFocusQuestion);
      formData.append('selected_private_question', selectedPrivateFaq);
      formData.append('public_others', '');
      formData.append('private_faq_answer', privateFaqAnswer);
      formData.append('privateOthers', privateOthers);
      if (fbFile) formData.append('fb_screenshot', fbFile);
      if (googleFile) formData.append('google_screenshot', googleFile);

      await submitReview(formData);
      setSubmitted(true);
    } catch (errorValue) {
      if (isApiError(errorValue) && typeof errorValue.payload === 'object' && errorValue.payload) {
        const payload = errorValue.payload as Record<string, unknown>;
        const code = payload.code;
        if (code === 'MAX_REVIEWS') setError('Maximum reviews reached. Thank you.');
        else if (code === 'SCREENSHOT_REQUIRED') setError('Please upload at least one screenshot.');
        else if (code === 'DUPLICATE_REVIEW') setError('You already submitted feedback.');
        else setError(typeof payload.message === 'string' ? payload.message : 'Submission failed. Please try again.');
      } else {
        setError('Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="page-shell"><div className="page-card narrow centered">Loading review link...</div></div>;
  }

  return (
    <div className="page-shell">
      <div className="center-column stack">
         <div className="hero-logo" style={{ margin: 0 }}>
            <img src="/logo.png" alt="Renaissance Park logo" />
          </div>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div style={{ width: 96 }} />

          <select className="select" style={{ width: 110 }} value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'tl' | 'hil')}>
            <option value="en">English</option>
            <option value="tl">Tagalog</option>
            <option value="hil">Hiligaynon</option>
          </select>
        </div>

        {occupantStatus !== 'valid' ? (
          <div
            className="page-card narrow centered status-card error"
            style={{
              fontSize: '32px',
              fontFamily: 'Playfair Display',
              fontWeight: 500
            }}
          >
            {occupantMessage}
          </div>
        ) : null}
        
        {occupantStatus === 'valid' ? (
          <>
            {!submitted ? (
              <div className="page-card narrow stack" style={{ alignItems: 'left' }}>
                <div className="centered">
                  <h1 style={{ marginBottom: 8 }}>{headerText}</h1>
                  <p className="muted" style={{ marginTop: 0 }}>{subHeaderText}</p>
                  <ul className="list" style={{ display: 'inline-block', textAlign: 'left' }}>
                    {occupantNames.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                  <p><strong>Date of Interment:</strong> {intermentDate}</p>
                </div>

                {error ? <div className="status-card error">{error}</div> : null}

                <form className="stack" onSubmit={handleSubmit}>
                  {step === 1 ? (
                    <div className="stack">
                      <h2 style={{ marginBottom: 0 }}>Reviewer Information</h2>
                      <input className="input" value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="Your name" />
                      <input className="input" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Contact number" />
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="button" type="button" onClick={() => setStep(2)} disabled={!reviewerName.trim() || !contactNumber.trim()}>
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="stack">
                      <h2 style={{ marginBottom: 0 }}>Public Review</h2>
                      <div className="status-card">
                        <div className="row between" style={{ alignItems: 'flex-start' }}>
                          <strong>{focusPool[focusIndex] || selectedFocusQuestion}</strong>
                          <button className="button ghost small" type="button" onClick={nextPublicQuestion}>Try another</button>
                        </div>
                        <p className="helper">This question helps keep the review focused and respectful.</p>
                        <button className="button secondary small" type="button" onClick={() => setSelectedFocusQuestion(focusPool[focusIndex] || selectedFocusQuestion)}>
                          Use this question
                        </button>
                      </div>

                      <div className="status-card">
                        <p style={{ marginTop: 0 }}><strong>How to leave a review</strong></p>
                        <ol className="list">
                          <li>Open the Facebook review page.</li>
                          <li>Post your review.</li>
                          <li>Take a screenshot of the posted review.</li>
                          <li>Upload the screenshot here.</li>
                        </ol>
                      </div>

                      <a className="button" href="https://www.facebook.com/RenaissanceParkAndChapels/reviews" target="_blank" rel="noreferrer">
                        Leave a Review on Facebook
                      </a>

                      <label className="upload-dropzone">
                        <strong>Upload Facebook review screenshot</strong>
                        <div className="helper">Accepted formats: JPG, PNG • Max size: 10MB</div>
                        <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(event) => void handleFile(event, 'fb')} style={{ display: 'block', marginTop: 12 }} />
                      </label>

                      {fbPreview ? (
                        <div className="preview-frame stack">
                          <img src={fbPreview} alt="Facebook review preview" />
                          <div className="row">
                            <button type="button" className="button ghost small" onClick={() => { setFbFile(null); setFbPreview(null); }}>Remove</button>
                          </div>
                        </div>
                      ) : null}

                      <div className="row between" style={{ alignItems: 'center' }}>
                        <span className="helper">Need help?</span>
                        <button type="button" className="button ghost small" onClick={() => setShowExample((value) => !value)}>
                          {showExample ? 'Hide Example' : 'Show Example'}
                        </button>
                      </div>

                      {showExample ? (
                        <div className="preview-frame stack centered">
                          <img src="/example-review.png" alt="Example review screenshot" style={{ maxHeight: 380, objectFit: 'contain' }} />
                          <span className="helper">Example only.</span>
                        </div>
                      ) : null}

                      <div className="row between">
                        <button className="button ghost" type="button" onClick={() => setStep(1)}>Back</button>
                        <button className="button" type="button" onClick={() => setStep(3)} disabled={!fbPreview && !googlePreview}>Next</button>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="stack">
                      <h2 style={{ marginBottom: 0 }}>Private Feedback</h2>
                      <div className="status-card">
                        <div className="row between" style={{ alignItems: 'flex-start' }}>
                          <strong>{privatePool[privateIndex] || selectedPrivateFaq}</strong>
                          <button className="button ghost small" type="button" onClick={nextPrivateQuestion}>Change question</button>
                        </div>
                        <button className="button secondary small" type="button" onClick={() => setSelectedPrivateFaq(privatePool[privateIndex] || selectedPrivateFaq)}>
                          Select question
                        </button>
                      </div>

                      <textarea className="textarea" value={privateFaqAnswer} onChange={(event) => setPrivateFaqAnswer(event.target.value)} placeholder="Your answer here..." />
                      <textarea className="textarea" value={privateOthers} onChange={(event) => setPrivateOthers(event.target.value)} placeholder="Any other suggestions..." />

                      <div className="row between">
                        <button className="button ghost" type="button" onClick={() => setStep(2)}>Back</button>
                        <button className="button secondary" type="submit" disabled={submitting}>
                          {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </form>
              </div>
            ) : (
              <div className="page-card narrow centered stack">
                <h1 style={{ marginBottom: 8 }}>Thank You!</h1>
                <p className="muted" style={{ marginTop: 0 }}>Your review has been submitted successfully. We appreciate your feedback.</p>
              </div>
            )}

            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="button ghost" type="button" onClick={() => router.push(`/interments/${documentNo}`)}>
                Back to Home
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
