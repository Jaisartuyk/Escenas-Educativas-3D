export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '20px' }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>Last updated: March 6, 2026</p>
      
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>1. Information We Collect</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          LiveGames collects minimal information necessary to provide our services:
        </p>
        <ul style={{ lineHeight: '1.8', marginLeft: '20px' }}>
          <li>TikTok username (when you connect to TikTok Live)</li>
          <li>Game data and preferences you create</li>
          <li>Usage statistics to improve our service</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>2. How We Use Your Information</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          We use the collected information to:
        </p>
        <ul style={{ lineHeight: '1.8', marginLeft: '20px' }}>
          <li>Provide and maintain our Service</li>
          <li>Connect to your TikTok Live streams</li>
          <li>Improve user experience</li>
          <li>Communicate service updates</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>3. Data Storage and Security</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          Your data is stored securely and we implement appropriate technical and organizational measures to protect your personal information. We do not sell or share your personal data with third parties except as required to provide our services (e.g., TikTok API integration).
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>4. Third-Party Services</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          Our Service integrates with:
        </p>
        <ul style={{ lineHeight: '1.8', marginLeft: '20px' }}>
          <li><strong>TikTok:</strong> To connect to live streams and read engagement data</li>
          <li><strong>YouTube:</strong> To display karaoke videos</li>
        </ul>
        <p style={{ lineHeight: '1.6', marginTop: '15px' }}>
          These services have their own privacy policies, and we encourage you to review them.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>5. Cookies and Tracking</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          We use local storage to save your game preferences and settings. No tracking cookies are used for advertising purposes.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>6. Your Rights</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          You have the right to:
        </p>
        <ul style={{ lineHeight: '1.8', marginLeft: '20px' }}>
          <li>Access your personal data</li>
          <li>Request deletion of your data</li>
          <li>Opt-out of data collection</li>
          <li>Disconnect TikTok integration at any time</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>7. Children's Privacy</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          Our Service is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>8. Changes to This Policy</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '15px' }}>9. Contact Us</h2>
        <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
          If you have questions about this Privacy Policy, please contact us through our GitHub repository at: https://github.com/Jaisartuyk/LiveGames-SaaS
        </p>
      </section>
    </div>
  );
}
