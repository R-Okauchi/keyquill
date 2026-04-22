Pod::Spec.new do |s|
  s.name           = 'KeyquillMobile'
  s.version        = '0.1.0'
  s.summary        = 'Capacitor plugin for secure LLM API key storage and native LLM calls'
  s.license        = 'MIT'
  s.homepage       = 'https://github.com/R-Okauchi/keyquill'
  s.author         = 'R-Okauchi'
  s.source         = { :git => 'https://github.com/R-Okauchi/keyquill.git', :tag => "keyquill-mobile@#{s.version}" }
  s.source_files   = 'ios/Sources/**/*.{swift,m}'
  s.ios.deployment_target = '14.0'
  s.swift_version  = '5.9'
  s.dependency 'Capacitor'
end
