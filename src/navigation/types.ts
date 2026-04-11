export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Otp: { phone: string; requestId: string };
};

export type CustomerTabParamList = {
  Home: undefined;
  Cart: undefined;
  Profile: undefined;
};

export type CustomerProfileStackParamList = {
  ProfileMain: undefined;
  EditInfo: undefined;
  Security: undefined;
  HelpSupport: undefined;
};

export type DeliveryTabParamList = {
  AssignedOrders: undefined;
  Ongoing: undefined;
  History: undefined;
  DeliveryProfile: undefined;
};
