import React from 'react';
import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

const Contact: React.FC = () => {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl space-y-16 divide-y divide-gray-100 lg:mx-0 lg:max-w-none">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-3">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Get in touch</h2>
                            <p className="mt-4 leading-7 text-slate-600">
                                Have questions about Base16? Our team is ready to help you transform your school management experience.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-2 lg:gap-8">
                            <div className="rounded-2xl bg-slate-50 p-10">
                                <h3 className="text-base font-semibold leading-7 text-slate-900">Sales</h3>
                                <dl className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                                    <div>
                                        <dt className="sr-only">Email</dt>
                                        <dd><a className="font-semibold text-blue-600" href="mailto:sixzonesglobal@gmail.com">sixzonesglobal@gmail.com</a></dd>
                                    </div>
                                    <div className="mt-1">
                                        <dt className="sr-only">Phone</dt>
                                        <dd>050 256 0760</dd>
                                    </div>
                                </dl>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-10">
                                <h3 className="text-base font-semibold leading-7 text-slate-900">Support</h3>
                                <dl className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                                    <div>
                                        <dt className="sr-only">Email</dt>
                                        <dd><a className="font-semibold text-blue-600" href="mailto:sixzonesglobal@gmail.com">sixzonesglobal@gmail.com</a></dd>
                                    </div>
                                    <div className="mt-1">
                                        <dt className="sr-only">Phone</dt>
                                        <dd>050 256 0760</dd>
                                    </div>
                                </dl>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-10">
                                <h3 className="text-base font-semibold leading-7 text-slate-900">Headquarters</h3>
                                <dl className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                                    <div>
                                        <dt className="sr-only">Address</dt>
                                        <dd>SixZones Tech Hub<br />Accra, Ghana</dd>
                                    </div>
                                </dl>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-10">
                                <h3 className="text-base font-semibold leading-7 text-slate-900">Socials</h3>
                                <dl className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                                    <div className="flex gap-x-4">
                                        <a href="#" className="text-slate-400 hover:text-slate-500">Twitter</a>
                                        <a href="#" className="text-slate-400 hover:text-slate-500">LinkedIn</a>
                                        <a href="#" className="text-slate-400 hover:text-slate-500">Facebook</a>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;
