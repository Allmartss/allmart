declare module 'react-qr-code' {
  import * as React from 'react';
  export interface QRCodeProps {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    title?: string;
  }
  export default class QRCode extends React.Component<QRCodeProps> {}
}
