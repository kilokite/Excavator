import 'vue'

declare module 'vue' {
    interface ComponentCustomProperties {
      $uigo: (path: string) => void;
    }
  }