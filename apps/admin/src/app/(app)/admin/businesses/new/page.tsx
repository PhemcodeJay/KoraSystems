'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewBusinessPage() {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [mpesaTill, setMpesaTill] = useState('');
  const [mpesaPaybill, setMpesaPaybill] = useState('');
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/smes', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({businessName, mpesaTill, mpesaPaybill})
    });
    if (res.ok) router.push('/admin/smes');
  }

  if (step === 1) {
    return (
      <div className='max-w-2xl mx-auto p-6'>
        <h1 className='text-2xl font-bold mb-6'>Create New Business</h1>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <input value={businessName} onChange={e => setBusinessName(e.target.value)} className='border p-2 w-full' placeholder='Business name' required />
          <input value={mpesaTill} onChange={e => setMpesaTill(e.target.value)} className='border p-2 w-full' placeholder='M-Pesa Till number' />
          <input value={mpesaPaybill} onChange={e => setMpesaPaybill(e.target.value)} className='border p-2 w-full' placeholder='M-Pesa Paybill' />
          <button type='submit' className='bg-brand-600 text-white px-4 py-2'>Continue</button>
        </form>
        <p className='text-sm mt-2 text-gray-500'>Step 1 of 3</p>
      </div>
    );
  }
  return (
    <div className='max-w-2xl mx-auto p-6'>
      <h1 className='text-2xl font-bold mb-6'>Add Payment Details</h1>
      <p className='text-gray-500 mb-4'>Enter your M-Pesa and bank details for receiving payments.</p>
      <button className='bg-brand-600 text-white px-4 py-2'>Skip for now</button>
    </div>
  );
}
