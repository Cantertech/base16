import React from 'react';

const Legal: React.FC = () => {
    return (
        <div className="bg-white px-6 py-32 lg:px-8">
            <div className="mx-auto max-w-3xl text-base leading-7 text-slate-700">
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Privacy Policy & Terms</h1>
                <p className="mt-6 text-xl leading-8">
                    At Base16, we take your privacy and data security seriously. This page outlines our commitment to protecting your school's data.
                </p>

                <div className="mt-10 max-w-2xl">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">1. Data Protection</h2>
                    <p className="mt-6">
                        We employ industry-standard encryption and security measures to ensure that student records, financial data, and staff information remain confidential and secure.
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-slate-900">2. Service Usage</h2>
                    <p className="mt-6">
                        Base16 is provided "as is" for educational management purposes. Users are responsible for maintaining the confidentiality of their account credentials.
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-slate-900">3. Third-Party Services</h2>
                    <p className="mt-6">
                        We may integrate with third-party services (like payment gateways) to provide enhanced functionality. These services have their own privacy policies.
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-slate-900">4. Contact Us</h2>
                    <p className="mt-6">
                        If you have any questions about these terms, please contact us at support@sixzones.com.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Legal;
