import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

export function LoginView({ onLogin, onRegister, t, notice = null, onClearNotice }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nombre, setNombre] = useState('');
  const [codigoReferido, setCodigoReferido] = useState('');

  const [splashOpacity, setSplashOpacity] = useState(1);
  const [splashDisplay, setSplashDisplay] = useState('flex');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setSplashOpacity(0);
      const timer2 = setTimeout(() => {
        setSplashDisplay('none');
      }, 800);
      return () => clearTimeout(timer2);
    }, 1200);
    return () => clearTimeout(timer1);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => {
      onClearNotice?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [notice, onClearNotice]);

  const handleFieldChange = (setter) => (event) => {
    onClearNotice?.();
    setter(event.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegistering) {
      if (!nombre.trim() || !email.trim() || !password.trim()) return;
      await onRegister(nombre, email, password, codigoReferido);
    } else {
      if (!email.trim() || !password.trim()) return;
      await onLogin(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegistering((prev) => !prev);
    setShowPassword(false);
    if (!isRegistering) {
      setEmail('');
      setPassword('');
      setNombre('');
      setCodigoReferido('');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div className="custom-login-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap');
        
        .custom-login-wrapper {
            width: 100%;
            height: 100vh;
            overflow: hidden;
            background-color: #ffffff;
            font-family: 'Montserrat', sans-serif;
            position: relative;
        }

        .custom-login-wrapper * {
            box-sizing: border-box;
            font-family: 'Montserrat', sans-serif;
        }

        #final-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            transform: rotate(180deg);
            background-color: #ffffff;
        }

        #splash-screen {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: center;
            z-index: 10;
            transition: opacity 0.8s ease-in-out;
            background-color: #ffffff;
        }

        .logo-container {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .brand-logo {
            display: inline-flex;
            align-items: center;
            line-height: 1;
            user-select: none;
        }

        .brand-logo-image {
            display: block;
        }

        .brand-logo-md .brand-logo-image {
            width: 420px;
            max-width: min(42vw, 420px);
            height: auto;
        }

        .brand-logo-sm .brand-logo-image {
            width: 120px;
            height: auto;
        }

        .brand-logo-xs .brand-logo-image {
            width: 104px;
            height: auto;
        }

        .sidebar-brand .brand-logo-image {
            width: 132px;
            height: auto;
        }

        .logo-icon {
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo-text {
            color: #000000;
            font-size: 68px;
            font-weight: 700;
            letter-spacing: -0.04em;
            line-height: 1;
            user-select: none;
        }

        #login-screen {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5;
            padding: 20px;
        }

        .login-card {
            display: flex;
            width: 100%;
            max-width: 900px;
            min-height: 550px;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .card-left {
            flex: 1;
            background-color: #0d0d0d;
            position: relative;
            padding: 50px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
        }

        .glow-beams {
            position: absolute;
            bottom: -50px;
            left: 0;
            width: 100%;
            height: 300px;
            background: 
                radial-gradient(ellipse at 30% 100%, rgba(255, 75, 0, 0.6) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 100%, rgba(255, 193, 7, 0.3) 0%, transparent 60%);
            z-index: 1;
        }

        .card-left h1 {
            color: #ffffff;
            font-size: 42px;
            font-weight: 300;
            line-height: 1.1;
            z-index: 2;
            position: relative;
            transform: translateY(-80px);
            margin: 0;
        }

        .text-orange-bold {
            color: #ff4b00;
            font-weight: 700;
        }

        .header-badge {
            display: flex;
            align-items: center;
            margin-bottom: 24px;
            z-index: 2;
            position: relative;
            transform: translateY(-80px);
        }

        .header-badge .icon-box {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .header-badge .brand-logo {
            display: block;
        }

        .power-text {
            position: absolute;
            bottom: 50px;
            right: 50px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            text-align: right;
            max-width: 200px;
            z-index: 2;
            line-height: 1.5;
        }

        .card-right {
            flex: 1;
            background-color: #ffffff;
            padding: 50px 60px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .register-prompt {
            margin-top: 24px;
            text-align: center;
            font-size: 14px;
            color: #666666;
        }

        .register-prompt a {
            color: #ff4b00;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.3s ease;
        }

        .register-prompt a:hover {
            color: #e64300;
            text-decoration: underline;
        }

        .card-right h2 {
            font-size: 32px;
            font-weight: 700;
            color: #1a1a1a;
            margin-top: 0;
            margin-bottom: 30px;
            letter-spacing: -0.02em;
        }

        .form-group {
            margin-bottom: 16px;
            display: flex;
            flex-direction: column;
        }

        .form-group label {
            font-size: 14px;
            font-weight: 600;
            color: #4a4a4a;
            margin-bottom: 8px;
        }

        .form-group input {
            width: 100%;
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid #e0e0e0;
            font-size: 15px;
            transition: all 0.3s ease;
            background-color: #f9f9f9;
            color: #333;
            outline: none;
        }

        .password-field {
            position: relative;
            width: 100%;
        }

        .password-field input {
            display: block;
            padding-right: 52px;
        }

        .password-toggle {
            position: absolute;
            top: 50%;
            right: 12px;
            transform: translateY(-50%);
            width: 32px;
            height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 999px;
            background: transparent;
            color: #8a8a8a;
            cursor: pointer;
            transition: background-color 0.2s ease, color 0.2s ease;
        }

        .password-toggle:hover {
            background-color: rgba(255, 75, 0, 0.08);
            color: #ff4b00;
        }

        .form-group input::placeholder {
            color: #b0b0b0;
        }

        .form-group input:focus {
            border-color: #ff4b00;
        }

        .optional-text {
            font-size: 12px;
            font-weight: 400;
            color: #999999;
            margin-left: 4px;
        }

        .input-highlight {
            border: 2px solid #ff4b00 !important;
            background-color: #fff !important;
            box-shadow: 0 0 0 4px rgba(255, 75, 0, 0.1);
            outline: none;
        }

        .submit-btn {
            width: 100%;
            padding: 16px;
            background-color: #ff4b00;
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            margin-top: 10px;
            transition: background-color 0.3s ease, transform 0.1s ease;
        }

        .submit-btn:hover {
            background-color: #e64300;
        }
        
        .submit-btn:active {
            transform: scale(0.98);
        }

        .inline-login-notice {
            margin-top: 10px;
            border-radius: 14px;
            border: 1px solid #ffd8cc;
            background: linear-gradient(135deg, rgba(255, 244, 240, 0.96), rgba(255, 250, 247, 0.96));
            color: #ff4b00;
            padding: 12px 14px;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.45;
            box-shadow: 0 10px 24px -18px rgba(255, 75, 0, 0.4);
        }

        @media (max-width: 768px) {
            .custom-login-wrapper {
                min-height: 100svh;
                height: auto;
            }
            .login-card {
                flex-direction: column;
                max-width: 100%;
                min-height: auto;
                border-radius: 28px;
            }
            .card-left {
                padding: 28px 22px 24px;
                min-height: 240px;
                justify-content: flex-start;
            }
            .card-right {
                padding: 28px 22px 30px;
            }
            .card-left h1, .header-badge {
                transform: translateY(0);
            }
            .card-left h1 {
                font-size: 34px;
                margin-top: 10px;
            }
            .power-text {
                position: static;
                margin-top: 28px;
                max-width: none;
                text-align: left;
                font-size: 13px;
            }
            .card-right h2 {
                font-size: 28px;
                margin-bottom: 22px;
            }
            .submit-btn {
                padding: 15px;
                font-size: 15px;
            }
        }

        @media (max-width: 520px) {
            #login-screen {
                padding: 12px;
                align-items: stretch;
            }
            .login-card {
                min-height: calc(100svh - 24px);
                border-radius: 24px;
            }
            .card-left {
                padding: 24px 18px 20px;
                min-height: 220px;
            }
            .card-right {
                padding: 24px 18px 26px;
            }
            .brand-logo-xs .brand-logo-image {
                width: 92px;
            }
            .card-left h1 {
                font-size: 29px;
            }
            .form-group input {
                padding: 13px 14px;
                font-size: 14px;
            }
            .password-field input {
                padding-right: 48px;
            }
        }
      `}</style>

      <div id="final-bg"></div>

      <div id="splash-screen" style={{ opacity: splashOpacity, display: splashDisplay }}>
        <div className="logo-container">
          <BrandLogo variant="dark" size="md" />
        </div>
      </div>

      <div id="login-screen">
        <div className="login-card">
          <div className="card-left">
            <div className="glow-beams"></div>

            <div className="header-badge">
              <div className="icon-box">
                <BrandLogo variant="light" size="xs" />
              </div>
            </div>

            <h1>{t('login_headline_prefix')} <span className="text-orange-bold">{t('login_headline_focus')}</span><br />{t('login_headline_suffix')} <span style={{ fontWeight: 700 }}>{t('login_headline_emphasis')}</span></h1>

            <div className="power-text">
              {t('login_power_line1')}<br />{t('login_power_line2')}
            </div>
          </div>

          <div className="card-right">
            {!isRegistering ? (
              <div id="login-view">
                <h2>{t('login_start')}</h2>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>{t('login_email_label')}</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={handleFieldChange(setEmail)}
                      placeholder={t('login_email_placeholder')}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('login_password_label')}</label>
                    <div className="password-field">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={handleFieldChange(setPassword)}
                        className="input-highlight"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? t('login_hide_password') : t('login_show_password')}
                        title={showPassword ? t('login_hide_password') : t('login_show_password')}
                      >
                        {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </div>
                    {notice && !isRegistering && (
                      <div className="inline-login-notice">{notice.message}</div>
                    )}
                  </div>
                  <button type="submit" className="submit-btn">{t('login_submit')}</button>

                  <p className="register-prompt">{t('login_no_account')} <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>{t('login_register')}</a></p>
                </form>
              </div>
            ) : (
              <div id="register-view">
                <h2>{t('login_create_account')}</h2>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>{t('login_name_label')}</label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={nombre}
                      onChange={handleFieldChange(setNombre)}
                      placeholder={t('login_name_placeholder')}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('login_email_label')}</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={handleFieldChange(setEmail)}
                      placeholder={t('login_email_placeholder')}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('login_password_label')}</label>
                    <div className="password-field">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={handleFieldChange(setPassword)}
                        className="input-highlight"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? t('login_hide_password') : t('login_show_password')}
                        title={showPassword ? t('login_hide_password') : t('login_show_password')}
                      >
                        {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </div>
                    {notice && isRegistering && (
                      <div className="inline-login-notice">{notice.message}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>{t('login_team_code_label')} <span className="optional-text">({t('common_optional')})</span></label>
                    <input
                      type="text"
                      value={codigoReferido}
                      onChange={handleFieldChange(setCodigoReferido)}
                      placeholder={t('login_team_code_placeholder')}
                    />
                  </div>
                  <button type="submit" className="submit-btn">{t('login_register_submit')}</button>

                  <p className="register-prompt">{t('login_have_account')} <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>{t('login_sign_in')}</a></p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
