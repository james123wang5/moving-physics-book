import { CircleLesson } from './circle.js';

// 每课的立体装置：键是 content/lessons.js 里的课号 n，值是这一课的装置类（继承 DioramaLesson）。
// 没登记的课只有书页（左页文字、翻盖、印章照常），右页没有立体插图。

export const APPARATUS = {
  1: CircleLesson,
};
